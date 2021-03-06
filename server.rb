require 'sinatra'
require 'sinatra/json'
require 'rack/parser'
require 'ruby-supervisor'
require 'fsdb'
require 'json'
require 'rack'
require 'thread'

db_path = ARGV[0] || 'db'
if !db_path || db_path.empty?
  raise 'Specify a database path.'
end

def initialize_database(path)
  db = FSDB::Database.new(path)
  db['hosts'] = [] if !db['hosts']
  db
end

class RequestError < StandardError
end

class ConnectionPool
  def initialize
    @clients = {}
    @client_lock = Mutex.new
  end

  def connect(host)
    client_id = "#{host[:host]}:#{host[:port]}"

    client = nil
    @client_lock.synchronize { client = @clients[client_id] }

    if !client
      client = RubySupervisor::Client.new(host[:host], host[:port], timeout: 5)
      @client_lock.synchronize { @clients[client_id] = client }
    end

    client
  end
end

$db = initialize_database(db_path)
$pool = ConnectionPool.new

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
  handle_errors do
    erb :index
  end
end

get '/hosts/:id/logs' do
  handle_errors do
    erb :logs
  end
end

get '/hosts/:id' do
  handle_errors do
    host = find_host(:id)

    error = nil
    version = nil
    processes = []
    begin
      client = $pool.connect(host)
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
    client = $pool.connect(host)
    
    # TODO: Handle case when we cannot connect.
    json client.processes
  end
end

get '/hosts/:id/process/log' do
  handle_errors do
    host = find_host(:id)
    group = str_param(:group)
    name = str_param(:name)

    # TODO: Sanity checks.
    length = int_param(:length)

    # TODO: More param validation.
    client = $pool.connect(host)
    process = client.process("#{group}:#{name}")

    raise RequestError, 'Process does not exist.' if !process

    stdout = process.logs.read(-length, 0, :stdout)
    stderr = process.logs.read(-length, 0, :stderr)

    json stdout: stdout, stderr: stderr
  end
end

post '/hosts/:id/process/command' do
  handle_errors do
    host = find_host(:id)
    group = str_param(:group)
    name = str_param(:name)
    command = str_param(:command)

    # TODO: More param validation.
    client = $pool.connect(host)
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

    process = client.processes.select do |p|
      (p['group'] == group) && (p['name'] == name)
    end.first

    json process
  end
end
