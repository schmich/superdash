var app = angular.module('superdash', ['angular.filter']);

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
      })
      .error(function(res) {
        // TODO
      });
  };

  $scope.update();
});

app.controller('CreateHostCtrl', function($scope, $http) {
  $scope.name = null;
  $scope.host = null;
  $scope.port = 9001;

  $scope.submit = function() {
    $http.post('/hosts', { name: $scope.name, host: $scope.host, port: $scope.port })
      .success(function(res) {
        $scope.update();
      })
      .error(function(res) {
        // TODO
      });
  };
});

app.controller('HostCtrl', function($scope, $http) {
  $scope.delete = function(host) {
    var remove = confirm('Remove this host?');
    if (remove) {
      $http.delete('/hosts/' + host.id)
        .success(function(res) {
          // TODO: Refresh from server?
          // TODO: Confirm?
          delete $scope.hosts[host.id];
        })
        .error(function(res) {
          // TODO
        });
    }
  };
});

app.controller('ProcessCtrl', function($scope, $http) {
  $scope.states = states;

  $scope.control = function(process, command) {
    var params = {
      group: process.group,
      name: process.name, 
      command: command
    };

    $http.post('/hosts/' + $scope.host.id + '/process/command', params)
      .success(function(res) {
        $scope.host.processes = res;
      })
      .error(function(res) {
        // TODO
      });
  };

  function updateLog(process) {
    var params = {
      group: process.group,
      name: process.name
    };

    $http.get('/hosts/' + $scope.host.id + '/process/log', { params: params })
      .success(function(res) {
        process.log = res.log.replace(/(^\s*)|(\s*$)/g, '');
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
