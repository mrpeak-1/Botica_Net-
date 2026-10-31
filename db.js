const mysql = require('mysql2/promise');

// pool para conexiones
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // En XAMPP por defecto es vacío (''); cambiar si tu MySQL tiene contraseña
    database: 'botica_db',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Permite múltiples sentencias en una sola llamada si fuera necesario
    multipleStatements: false
});

/**
 * Funcion opcional para probar la conexión al iniciar el servidor
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexion exitosa a la base de datos MySQL (botica_db)');
        connection.release();
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos MySQL:');
        console.error('Detalle:', error.message);
    }
}

// Ejecuta la prueba de conexion
testConnection();

module.exports = pool;
