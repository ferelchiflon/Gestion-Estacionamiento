<?php
namespace App\Core;

use PDO;

abstract class Model {
    protected $table;
    protected $primaryKey = 'id';
    
    // Pública: el patrón del proyecto accede $model->db desde los controladores
    public $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    public function all($orderBy = null) {
        $sql = "SELECT * FROM {$this->table}";
        if($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }
        return $this->db->query($sql)->fetchAll();
    }
    
    public function find($id) {
        $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = ?";
        return $this->db->query($sql, [$id])->fetch();
    }
    
    public function where($conditions, $params = []) {
        $sql = "SELECT * FROM {$this->table} WHERE {$conditions}";
        return $this->db->query($sql, $params)->fetchAll();
    }
    
    public function insert($data) {
        $fields = array_keys($data);
        $placeholders = array_fill(0, count($fields), '?');
        
        $sql = "INSERT INTO {$this->table} (" . implode(', ', $fields) . ") 
                VALUES (" . implode(', ', $placeholders) . ")";
        
        $this->db->query($sql, array_values($data));
        return $this->db->lastInsertId();
    }
    
    public function update($id, $data) {
        $fields = array_map(function($field) {
            return "{$field} = ?";
        }, array_keys($data));
        
        $sql = "UPDATE {$this->table} SET " . implode(', ', $fields) . " WHERE {$this->primaryKey} = ?";
        $params = array_merge(array_values($data), [$id]);
        
        return $this->db->query($sql, $params)->rowCount();
    }
    
    public function delete($id) {
        $sql = "DELETE FROM {$this->table} WHERE {$this->primaryKey} = ?";
        return $this->db->query($sql, [$id])->rowCount();
    }
}