var app = angular.module('superdash', []);

app.controller('DashboardCtrl', function($scope, $http) {
  $scope.hosts = [];

  $http.get('/status')
    .success(function(res) {
      console.log(res);
      $scope.hosts = res;
    });
});
