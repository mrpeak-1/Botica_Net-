-- creacion bd
CREATE DATABASE IF NOT EXISTS botica_db
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE botica_db;

-- eliminar tablas previas en orden si existen para evitar conflictos
DROP TABLE IF EXISTS detalle_ventas;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS productos;

-- tabla de PRODUCTOS (Inventario)
CREATE TABLE productos (
    id_producto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 10,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- tabla de VENTAS (Comprobante)
CREATE TABLE ventas (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    numero_comprobante VARCHAR(20) NOT NULL UNIQUE,
    cliente VARCHAR(100) NOT NULL DEFAULT 'Público General',
    total DECIMAL(10, 2) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- tabla de DETALLE_VENTAS (Relación muchos a muchos entre ventas y productos)
CREATE TABLE detalle_ventas (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE RESTRICT
);

-- DATOS INICIALES DE PRUEBA
-- incluye productos con stock normal y productos en alerta de reposición (stock <= stock_minimo)

INSERT INTO productos (nombre, categoria, precio, stock, stock_minimo) VALUES
-- medicamentos con stock suficiente
('Paracetamol 500mg (Caja x 20)', 'Analgésicos', 4.50, 45, 10),
('Ibuprofeno 400mg (Blister x 10)', 'Antiinflamatorios', 3.20, 30, 10),
('Loratadina 10mg (Blister x 10)', 'Antihistamínicos', 5.00, 25, 8),
('Omeprazol 20mg (Caja x 30)', 'Gastroenterología', 8.50, 40, 12),
('Vitamina C 1g Efervescente', 'Vitaminas', 18.00, 20, 5),
('Alcohol Medicinal 70° (500ml)', 'Cuidado Personal', 6.00, 35, 10),
('Gasas Estériles (Sobre x 5)', 'Material Médico', 2.50, 50, 15),

-- medicamentos con STOCK BAJO (Para disparar la alerta de reposición de inmediato en el sistema)
('Amoxicilina 500mg (Blister x 10)', 'Antibióticos', 6.50, 4, 15),
('Azitromicina 500mg (Caja x 3)', 'Antibióticos', 14.00, 2, 8),
('Salbutamol Inhalador 100mcg', 'Respiratorios', 16.50, 3, 10),
('Termómetro Digital Clínico', 'Dispositivos Médicos', 12.00, 1, 5);

-- ventas de prueba iniciales para tener historial
INSERT INTO ventas (numero_comprobante, cliente, total, fecha) VALUES
('B001-00001', 'James Bond Armani', 9.00, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('B001-00002', 'Rosa Flores Quispe', 24.50, DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- detalle de las ventas iniciales
INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 2, 4.50, 9.00),   -- 2 Paracetamol a 4.50 = 9.00
(2, 2, 2, 3.20, 6.40),   -- 2 Ibuprofeno a 3.20 = 6.40
(2, 5, 1, 18.00, 18.00); -- 1 Vitamina C a 18.00 = 18.00

