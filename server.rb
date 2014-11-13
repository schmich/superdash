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
    raise RequestError, "Invalid parameter: #{name}." if !/\d+/.match(param)
    param.to_i
  end

  def required_param(name)
    param = params[name]
    raise RequestError, "Missing parameter: #{name}." if !param || param.empty?
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

    processes = []
    begin
      client = RubySupervisor::Client.new(host[:host], host[:port])
      processes = client.processes
    rescue
      # TODO: Report some connection error.
    end

    status = {
      id: host[:id],
      name: host[:name],
      host: host[:host],
      port: host[:port],
      processes: processes
    }

    json status
  end
end

get '/hosts' do
  json $db['hosts']
end

post '/hosts' do
  handle_errors do
    name = required_param(:name)
    host = required_param(:host)
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

    name = required_param(:name)
    host = required_param(:host)
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
    client = RubySupervisor::Client.new(host[:host], host[:port])
    
    json client.processes
  end
end

post '/hosts/:id/processes/command' do
  handle_errors do
    host = find_host(:id)
    group = required_param(:group)
    name = required_param(:name)
    command = required_param(:command)

    # TODO: More param validation.
    client = RubySupervisor::Client.new(host[:host], host[:port])
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

    json true
  end
end
