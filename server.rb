require 'sinatra'
require 'sinatra/json'
require 'rack/parser'
require 'ruby-supervisor'
require 'fsdb'
require 'json'
require 'rack'

db_path = ARGV[0] || 'db'
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

# TODO: Cache connections.
def connect(host)
  RubySupervisor::Client.new(host[:host], host[:port], timeout: 2)
end

def handle_errors
  begin
    return yield
  rescue RequestError => e
    status 400
    json error: e.to_s
  rescue => e
    puts e
    puts e.backtrace
    status 500
    json error: 'Internal error.'
  end
end

use Rack::Static, 
  :urls => ['/public'],
  :root => '.'

use Rack::Parser, content_types: {
  'application/json' => Proc.new { |body| JSON.decode body }
}

helpers do
  def int_param(name)
    param = required_param(name)
    raise RequestError, "Invalid parameter: #{name}." if !/\d+/.match(param.to_s)
    param.to_i
  end

  def str_param(name)
    param = required_param(name)
    raise RequestError, "Invalid parameter: #{name}." if /^\s*$/.match(param.to_s)
    param.to_s
  end

  def required_param(name)
    param = params[name]
    raise RequestError, "Missing parameter: #{name}." if !param
    param
  end

  def find_host(id_name)
    id = int_param(id_name)
    hosts = $db['hosts']
    host = hosts.find { |h| h[:id] == id }
    raise RequestError, 'Host does not exist.' if !host
    host
  end
end

get '/' do
  erb :index
end

get '/hosts/:id' do
  handle_errors do
    host = find_host(:id)

    error = nil
    version = nil
    processes = []
    begin
      client = connect(host)
      version = client.version
      processes = client.processes
    rescue => e
      error = e.to_s
    end

    status = {
      id: host[:id],
      name: host[:name],
      host: host[:host],
      port: host[:port],
      version: version,
      processes: processes
    }

    status[:error] = error if error

    json status
  end
end

get '/hosts' do
  json $db['hosts']
end

post '/hosts' do
  handle_errors do
    name = str_param(:name)
    host = str_param(:host)
    port = int_param(:port)

    id = nil
    $db.edit 'hosts' do |hosts|
      if hosts.empty?
        id = 0
      else
        id = hosts.map { |h| h[:id] }.max + 1
      end
      hosts << { id: id, name: name, host: host, port: port }
    end

    json id: id
  end
end

patch '/hosts/:id' do
  handle_errors do
    id = int_param(:id)

    name = str_param(:name)
    host = str_param(:host)
    port = int_param(:port)

    $db.edit 'hosts' do |hosts|
      target = hosts.find { |h| h[:id] == id }

      raise RequestError, 'Host does not exist.' if !target

      target[:name] = name
      target[:host] = host
      target[:port] = port
    end

    json true
  end
end

delete '/hosts/:id' do
  handle_errors do
    id = int_param(:id)

    $db.edit 'hosts' do |hosts|
      before = hosts.length
      hosts.reject! { |h| h[:id] == id }

      raise RequestError, 'Host does not exist.' if hosts.length == before
    end

    json true
  end
end

get '/hosts/:id/processes' do
  handle_errors do
    host = find_host(:id)
    client = connect(host)
    
    # TODO: Handle case when we cannot connect.
    json client.processes
  end
end

get '/hosts/:id/process/log' do
  handle_errors do
    host = find_host(:id)
    group = str_param(:group)
    name = str_param(:name)

    # TODO: More param validation.
    client = connect(host)
    process = client.process("#{group}:#{name}")

    raise RequestError, 'Process does not exist.' if !process

    json log: process.logs.read(-1000, 0)
  end
end

post '/hosts/:id/process/command' do
  handle_errors do
    host = find_host(:id)
    group = str_param(:group)
    name = str_param(:name)
    command = str_param(:command)

    # TODO: More param validation.
    client = connect(host)
    process = client.process("#{group}:#{name}")

    raise RequestError, 'Process does not exist.' if !process

    case command.downcase
    when 'start'
      process.start
    when 'stop'
      process.stop
    when 'restart'
      process.restart
    else
      raise RequestError, 'Invalid command.'
    end

    json client.processes
  end
end
