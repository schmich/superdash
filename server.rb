require 'sinatra'
require 'sinatra/json'
require 'ruby-supervisor'
require 'fsdb'

db_path = ARGV[0]
if !db_path || db_path.empty?
  raise 'Specify a database path.'
end

def initialize_database(path)
  db = FSDB::Database.new(path)
  db['hosts'] = [] if !db['hosts']
  db
end

$db = initialize_database(db_path)

class RequestError < StandardError
end

def handle_errors
  begin
    return yield
  rescue RequestError => e
    status 400
    json error: e.to_s
  rescue => e
    puts e
    status 500
    json error: 'Internal error.'
  end
end

get '/' do
  erb :index
end

get '/status' do
  hosts = $db['hosts']

  status = []
  hosts.each do |host|
    client = RubySupervisor::Client.new(host[:host], host[:port])
    status << {
      name: host[:name],
      host: host[:host],
      port: host[:port],
      processes: client.processes
    }
  end

  json status
end

get '/hosts' do
  json $db['hosts']
end

post '/hosts' do
  handle_errors do
    name, host, port = params[:name], params[:host], params[:port]

    raise RequestError, 'Name required.' if !name || name.empty?
    raise RequestError, 'Host required.' if !host || host.empty?
    raise RequestError, 'Port required.' if !port || port.empty?
    raise RequestError, 'Invalid port.' if !/\d+/.match(port)
    port = port.to_i

    id = nil
    $db.edit 'hosts' do |hosts|
      if hosts.empty?
        id = 0
      else
        id = hosts.map { |host| host[:id] }.max + 1
      end
      hosts << { id: id, name: name, host: host, port: port }
    end

    json id: id
  end
end

patch '/hosts/:id' do
  handle_errors do
    id = params[:id]
    raise RequestError, 'Invalid ID.' if !/\d+/.match(id)
    id = id.to_i

    name, host, port = params[:name], params[:host], params[:port]

    raise RequestError, 'Name required.' if !name || name.empty?
    raise RequestError, 'Host required.' if !host || host.empty?
    raise RequestError, 'Port required.' if !port || port.empty?

    $db.edit 'hosts' do |hosts|
      target = hosts.find { |host| host[:id] == id }

      raise RequestError, 'Host does not exist.' if !target

      target[:name] = name
      target[:host] = host
      target[:port] = port
    end

    json {}
  end
end

delete '/hosts/:id' do
  handle_errors do
    id = params[:id]
    raise RequestError, 'Invalid ID.' if !/\d+/.match(id)
    id = id.to_i

    $db.edit 'hosts' do |hosts|
      before = hosts.length
      hosts.reject! { |host| host[:id] == id }

      raise RequestError, 'Host does not exist.' if hosts.length == before
    end

    json {}
  end
end

get '/hosts/:id/processes' do
  handle_errors do
    id = params[:id]
    raise RequestError, 'Invalid ID.' if !/\d+/.match(id)
    id = id.to_i

    hosts = $db['hosts']
    host = hosts.find { |h| h[:id] == id }
    raise RequestError, 'Host does not exist.' if !host

    client = RubySupervisor::Client.new(host[:host], host[:port])
    
    json client.processes
  end
end
