require 'rack'
require './server'

map '/public' do
  run Rack::Directory.new('./public')
end

run Sinatra::Application
