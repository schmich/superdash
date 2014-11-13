var app = angular.module('superdash', ['angular.filter']);

app.controller('DashboardCtrl', function($scope, $http) {
  $scope.hosts = {};

  $scope.update = function() {
    $http.get('/hosts')
      .success(function(res) {
        for (var i = 0; i < res.length; ++i) {
          var host = res[i];
          $scope.hosts[host.id] = host;
        }

        for (var id in $scope.hosts) {
          var host = $scope.hosts[id];
          $http.get('/hosts/' + host.id)
            .success(function(res) {
              $scope.hosts[res.id].processes = res.processes;
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
  $scope.control = function(process, command) {
    var params = {
      group: process.group,
      name: process.name, 
      command: command
    };

    $http.post('/hosts/' + $scope.host.id + '/processes/command', params)
      .success(function(res) {
      })
      .error(function(res) {
        // TODO
      });
  };
});
