var app = angular.module('superdash', ['angular.filter']);

// TODO
// Handle ALREADY_STARTED/ALREADY_STOPPED issues with process control
// Warning if log is empty (flush output)
// Ability to expand/collapse server segments (preserve settings in localStorage)
// Fullscreen log viewing
// stdout/stderr tabs
// Watch/unwatch issues
// Better inline form to add host (after all existing hosts)
// Header?
// Allow scrolling in log output (suspend auto-scroll)
// Implement stop all/start all
// Move "Add host" to bottom of page
// Clear form inputs after new host is created (form reset)
// Pri 2: Group pivot

var states = {
  stopped: 0,
  starting: 10,
  running: 20,
  backoff: 30,
  stopping: 40,
  exited: 100,
  fatal: 200,
  unknown: 1000
};

function escapeHtml(string) {
  var entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entities[s];
  });
}

app.controller('DashboardCtrl', function($scope, $http) {
  $scope.hosts = {};

  $scope.update = function() {
    $http.get('/hosts')
      .success(function(res) {
        for (var i = 0; i < res.length; ++i) {
          var host = res[i];
          $scope.hosts[host.id] = host;
          host.connected = false;
          host.error = null;
        }

        for (var id in $scope.hosts) {
          $http.get('/hosts/' + id)
            .success(function(res) {
              var host = $scope.hosts[res.id];
              host.connected = (res.error == null);
              host.error = res.error;
              host.processes = res.processes;
              host.version = res.version;
            })
            .error(function(res) {
              // TODO
            });
        }

        if (res.length == 0) {
          window.location.hash = '#add-host';
        }
      })
      .error(function(res) {
        // TODO
      });
  };

  $scope.update();
});

app.controller('AddHostCtrl', function($scope, $http) {
  $scope.name = null;
  $scope.host = null;
  $scope.port = 9001;

  $scope.submit = function() {
    $http.post('/hosts', { name: $scope.name, host: $scope.host, port: $scope.port })
      .success(function(res) {
        $scope.update();
        $scope.name = null;
        $scope.host = null;
        $scope.port = 9001;
        $scope.showHostForm = false;
        window.location.hash = '';
        window.history.replaceState(null, null, '/');
      })
      .error(function(res) {
        alert(res.error);
      });
  };

  $scope.cancel = function() {
    $scope.showHostForm = false; 
    window.location.hash = '';
    window.history.replaceState(null, null, '/');
  };
});

app.controller('HostCtrl', function($scope, $http) {
  $scope.delete = function(host) {
    var remove = confirm('Remove this host?');
    if (!remove) {
      return;
    }

    $http.delete('/hosts/' + host.id)
      .success(function(res) {
        // TODO: Refresh from server?
        // TODO: Confirm?
        delete $scope.hosts[host.id];

        if (Object.keys($scope.hosts).length == 0) {
          window.location.hash = '#add-host';
        }
      })
      .error(function(res) {
        // TODO
      });
  };
});

app.controller('ProcessCtrl', function($scope, $http, $sce) {
  $scope.states = states;

  $scope.control = function(process, command) {
    var params = {
      group: process.group,
      name: process.name, 
      command: command
    };

    process.updating = true;
    $http.post('/hosts/' + $scope.host.id + '/process/command', params)
      .success(function(res) {
        process.updating = false;
        $scope.host.processes = res;
      })
      .error(function(res) {
        process.updating = false;
        // TODO
        alert(res.error);
      });
  };

  function updateLog(process) {
    var params = {
      group: process.group,
      name: process.name,
      length: 2048
    };

    $http.get('/hosts/' + $scope.host.id + '/process/log', { params: params })
      .success(function(res) {
        var log = colorize(escapeHtml(res.log.replace(/(^\s*)|(\s*$)/g, '')));
        process.log = $sce.trustAsHtml(log);
      });

    if (process.watchLog) { 
      setTimeout(function() { updateLog(process); }, 1000);
    }
  }

  $scope.watchLog = function(process) {
    process.watchLog = !process.watchLog;

    if (process.watchLog) {
      updateLog(process);
    }
  };
});

app.controller('LogsCtrl', function($scope, $http, $sce) {
  $scope.host = null;
  $scope.process = null;

  var path = window.location.pathname;
  var search = window.location.search;

  search = search.replace(/^\?/, '');
  var params = {};
  var vars = search.split('&');
  for (var i = 0; i < vars.length; ++i) {
    var parts = vars[i].split('=');
    params[parts[0]] = parts[1];
  }

  var match = path.match(/hosts\/(\d+)\/logs/);
  if (match) {
    var hostId = match[1];
    $http.get('/hosts/' + hostId)
      .success(function(res) {
        $scope.host = res;
        var processes = res.processes;
        for (var i = 0; i < processes.length; ++i) {
          var process = processes[i];
          if ((process.group == params.group) && (process.name == params.name)) {
            $scope.process = process;
            break;
          }
        }
      })
      .error(function(res) {
        alert(res.error);
      });
  }

  $scope.$watch('process', function(newProcess) {
    if (newProcess != null) {
      updateLog();
    }
  });

  function updateLog() {
    var params = {
      group: $scope.process.group,
      name: $scope.process.name,
      length: 4096
    };

    $http.get('/hosts/' + $scope.host.id + '/process/log', { params: params })
      .success(function(res) {
        var log = colorize(escapeHtml(res.log.replace(/(^\s*)|(\s*$)/g, '')));
        $scope.process.log = $sce.trustAsHtml(log);
      });

    setTimeout(updateLog, 1000);
  }
});

app.filter('processState', function() {
  var names = {
    0: 'Stopped',
    10: 'Starting',
    20: 'Running',
    30: 'Backoff',
    40: 'Stopping',
    100: 'Exited',
    200: 'Fatal',
    1000: 'Unknown'
  };

  return function(input) {
    return names[input] || 'Unknown';
  };
});

app.filter('urlEscape', function() {
  return window.escape;
});

app.directive('autoscroll', function() {
  return {
    link: function(scope, elem, attrs) {
      scope.$watch(attrs.autoscroll, function() {
        elem[0].scrollTop = elem[0].scrollHeight;
      });
    }
  };
});

app.run(function($rootScope) {
  $rootScope.showHostForm = (window.location.hash == '#add-host');

  window.addEventListener('hashchange', function() {
    $rootScope.$apply(function() {
      $rootScope.showHostForm = (window.location.hash == '#add-host');
    });
  }, false);

  $rootScope.$watch('showHostForm', function(showing) {
    if (showing) {
      setTimeout(function() {
        document.forms['add-host'].elements[0].focus();
      }, 0);
    }
  });
});
