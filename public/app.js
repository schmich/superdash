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
          $scope.hosts[host.id].connected = false;
        }

        for (var id in $scope.hosts) {
          $http.get('/hosts/' + id)
            .success(function(res) {
              var host = $scope.hosts[res.id];
              host.connected = (res.error == null);
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
  $scope.port = null;

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
    $http.delete('/hosts/' + host.id)
      .success(function(res) {
        // TODO: Refresh from server?
        // TODO: Confirm?
        delete $scope.hosts[host.id];
      })
      .error(function(res) {
        // TODO
      });
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

  $scope.log = function(process) {
    var params = {
      group: process.group,
      name: process.name
    };

    $http.get('/hosts/' + $scope.host.id + '/process/log', { params: params })
      .success(function(res) {
        alert(res.log);
      });
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
