const mysql = require('mysql2/promise');

// Pool asíncrono compatible con XAMPP local (por defecto) y despliegue en la nube (Render / Railway / TiDB)
const poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root',
    database: process.env.DB_NAME || 'botica_net_db',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    multipleStatements: false
};

if (process.env.DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

/**
 * Funcion opcional para probar la conexión al iniciar el servidor
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('[DB] Conexión verificada con MySQL (botica_net_db)');
        connection.release();
    } catch (error) {
        console.error('[DB] Error al conectar con MySQL:', error.message);
    }
}

// Ejecuta la prueba de conexion
testConnection();

module.exports = pool;
