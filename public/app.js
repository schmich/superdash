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

// See http://misc.flogisoft.com/bash/tip_colors_and_formatting
var colorize = function(str) {
  var ansi = {
    '0':  'ansi-reset',
    '1':  'ansi-bold',
    '2':  'ansi-dim',
    '4':  'ansi-underline',
    '5':  'ansi-blink',
    '7':  'ansi-invert',
    '8':  'ansi-hidden',

    // Foreground (normal)
    '30': 'ansi-fg-black',
    '31': 'ansi-fg-red',
    '32': 'ansi-fg-green',
    '33': 'ansi-fg-yellow',
    '34': 'ansi-fg-blue',
    '35': 'ansi-fg-magenta',
    '36': 'ansi-fg-cyan',
    '37': 'ansi-fg-lgray',
    '39': 'ansi-fg-default',

    // Background (normal)
    '40': 'ansi-bg-black',
    '41': 'ansi-bg-red',
    '42': 'ansi-bg-green',
    '43': 'ansi-bg-yellow',
    '44': 'ansi-bg-blue',
    '45': 'ansi-bg-magenta',
    '46': 'ansi-bg-cyan',
    '47': 'ansi-bg-lgray',

    // Foreground (light)
    '90': 'ansi-fg-gray',
    '91': 'ansi-fg-lred',
    '92': 'ansi-fg-lgreen',
    '93': 'ansi-fg-lyellow',
    '94': 'ansi-fg-lblue',
    '95': 'ansi-fg-lmagenta',
    '96': 'ansi-fg-lcyan',
    '97': 'ansi-fg-white',

    // Background (light)
    '100': 'ansi-bg-gray',
    '101': 'ansi-bg-lred',
    '102': 'ansi-bg-lgreen',
    '103': 'ansi-bg-lyellow',
    '104': 'ansi-bg-lblue',
    '105': 'ansi-bg-lmagenta',
    '106': 'ansi-bg-lcyan',
    '107': 'ansi-bg-white'
  };

  str = str.replace(/\033\[((3|4|9|10)(\d))m(.*?)(?=(\033\[(0|((3|4|9|10)(\d)))m)|$)/g, function(match, p1, p2, p3, p4) {
    return '<span class="' + ansi[p1] + '">' + p4 + '</span>';
  });

  str = str.replace(/\033\[1m(.*?)(?=((\033\[(0|21)m)|$))/g, function(match, p1) {
    return '<span class="ansi-bold">' + p1 + '</span>';
  });

  str = str.replace(/\033\[2m(.*?)(?=((\033\[(0|22)m)|$))/g, function(match, p1) {
    return '<span class="ansi-dim">' + p1 + '</span>';
  });

  str = str.replace(/\033\[4m(.*?)(?=((\033\[(0|24)m)|$))/g, function(match, p1) {
    return '<span class="ansi-underline">' + p1 + '</span>';
  });

  str = str.replace(/\033\[5m(.*?)(?=((\033\[(0|25)m)|$))/g, function(match, p1) {
    return '<span class="ansi-blink">' + p1 + '</span>';
  });

  str = str.replace(/\033\[7m(.*?)(?=((\033\[(0|27)m)|$))/g, function(match, p1) {
    return '<span class="ansi-invert">' + p1 + '</span>';
  });

  str = str.replace(/\033\[8m(.*?)(?=((\033\[(0|28)m)|$))/g, function(match, p1) {
    return '<span class="ansi-hidden">' + p1 + '</span>';
  });

  str = str.replace(/\033\[(0|21|22|24|25|27|28)m/g, '');

  return str;
};

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

  function updateLog(process) {
    var params = {
      group: process.group,
      name: process.name
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
