<?php
namespace App\Core;

class Router {
    private $routes = [];
    private $notFoundCallback;
    
    public function add($method, $path, $callback) {
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $this->normalizePath($path),
            'callback' => $callback
        ];
    }
    
    public function get($path, $callback) {
        $this->add('GET', $path, $callback);
    }
    
    public function post($path, $callback) {
        $this->add('POST', $path, $callback);
    }
    
    public function put($path, $callback) {
        $this->add('PUT', $path, $callback);
    }
    
    public function delete($path, $callback) {
        $this->add('DELETE', $path, $callback);
    }
    
    public function setNotFound($callback) {
        $this->notFoundCallback = $callback;
    }
    
    private function normalizePath($path) {
        return trim($path, '/');
    }
    
    public function dispatch() {
        $requestMethod = $_SERVER['REQUEST_METHOD'];
        $requestUri = $this->normalizePath(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
        $basePath = $this->normalizePath(str_replace('/index.php', '', $_SERVER['SCRIPT_NAME']));
        
        if($basePath && strpos($requestUri, $basePath) === 0) {
            $requestUri = substr($requestUri, strlen($basePath));
            $requestUri = ltrim($requestUri, '/');
        }
        
        foreach($this->routes as $route) {
            if($route['method'] !== $requestMethod) continue;
            
            $pattern = preg_replace('/\{[a-zA-Z0-9_]+\}/', '([a-zA-Z0-9_]+)', $route['path']);
            $pattern = '#^' . $pattern . '$#';
            
            if(preg_match($pattern, $requestUri, $matches)) {
                array_shift($matches);
                $params = array_map('urldecode', $matches);
                
                if(is_callable($route['callback'])) {
                    call_user_func_array($route['callback'], $params);
                } elseif(is_string($route['callback']) && strpos($route['callback'], '@') !== false) {
                    list($controller, $method) = explode('@', $route['callback']);
                    $controllerClass = "App\\Controllers\\{$controller}";
                    
                    if(class_exists($controllerClass)) {
                        $controllerInstance = new $controllerClass();
                        if(method_exists($controllerInstance, $method)) {
                            call_user_func_array([$controllerInstance, $method], $params);
                        }
                    }
                }
                return;
            }
        }
        
        if($this->notFoundCallback) {
            call_user_func($this->notFoundCallback);
        } else {
            http_response_code(404);
            echo "404 - Página no encontrada";
        }
    }
}