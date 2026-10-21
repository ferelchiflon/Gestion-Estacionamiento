<?php
namespace App\Core;

abstract class Controller {
    protected function view($view, $data = []) {
        extract($data);
        $viewPath = BASE_PATH . "/app/view/{$view}.php";
        
        if(file_exists($viewPath)) {
            require_once BASE_PATH . '/app/view/layouts/header.php';
            require_once $viewPath;
            require_once BASE_PATH . '/app/view/layouts/footer.php';
        } else {
            die("Vista no encontrada: {$view}");
        }
    }
    
    protected function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    protected function redirect($url) {
        header("Location: " . BASE_URL . $url);
        exit;
    }
    
    protected function validate($data, $rules) {
        $errors = [];
        foreach($rules as $field => $rule) {
            $rulesArray = explode('|', $rule);
            foreach($rulesArray as $singleRule) {
                if($singleRule == 'required' && empty($data[$field])) {
                    $errors[$field][] = "El campo {$field} es requerido";
                }
                if(strpos($singleRule, 'min:') === 0) {
                    $min = explode(':', $singleRule)[1];
                    if(strlen($data[$field]) < $min) {
                        $errors[$field][] = "El campo {$field} debe tener al menos {$min} caracteres";
                    }
                }
            }
        }
        return $errors;
    }
}