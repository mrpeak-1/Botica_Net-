# 🏥 Botica Nova Salud — Sistema Web de Gestión de Inventario y Ventas

<table>
  <tr>
    <td valign="middle" width="65%">
      <strong>Sistema web fullstack</strong> diseñado para la gestión centralizada de inventario farmacéutico, ventas rápidas en punto de atención (POS) y generación automática de alertas para reposición de medicamentos con stock crítico. <br><br>
      Desarrollado con una arquitectura desacoplada: **Backend en Node.js + Express** con consultas relacionales en **MySQL**, y **Frontend en HTML5, CSS3, JavaScript** con efectos visuales dinámicos y retroalimentación sonora interactiva.
    </td>
    <td align="center" valign="middle" width="35%">
      <picture>
        <source srcset="https://user-images.githubusercontent.com/74038190/212257460-738ff738-247f-4445-a718-cdd0ca76e2db.gif">
        <img src="" width="200" alt="Node.js">
      </picture>
    </td>
  </tr>
</table>

---

## 📌 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu computadora:

1. **Node.js** (versión 18 o superior recomendada): [https://nodejs.org](https://nodejs.org)
2. **Servidor MySQL**:
   * Mediante **XAMPP** (recomendado para desarrollo local): [https://www.apachefriends.org](https://www.apachefriends.org)
   * O mediante **WampServer** o **MySQL Server** independiente.

---

## ⚠️ Checklist de Cosas Importantes (¡Fáciles de Pasar por Alto!)

> [!IMPORTANT]
> Revisa estos puntos antes de iniciar el proyecto para evitar los errores más comunes:

* 👉 **Asegúrate de tener XAMPP / WampServer / MySQL corriendo:** El servicio de MySQL debe estar en estado *Running* (en verde en el panel de control de XAMPP) antes de ejecutar cualquier comando de Node.js.
* 👉 **Asegúrate de haber importado el archivo `database.sql`:** La base de datos `botica_bd` y sus tablas deben estar creadas previamente en tu gestor MySQL.
* 👉 **Asegúrate de verificar tu contraseña de MySQL:**
  * En **XAMPP**, el usuario por defecto es `root` y la contraseña está **vacía** (`''`).
  * Si tu servidor MySQL tiene una contraseña (ej: `root`, `1234`, `admin`), debes configurarla en el archivo `db.js` en la línea:
    ```javascript
    password: 'TU_CONTRASEÑA_AQUI'
    ```
* 👉 **Asegúrate de haber ejecutado `npm install`:** Si acabas de clonar o descargar el proyecto, las carpetas de dependencias (`express`, `mysql2`) deben estar instaladas.
* 👉 **Asegúrate de que el puerto 3000 esté libre:** El servidor web correrá en `http://localhost:3000`. Si otra aplicación ya ocupa el puerto 3000, cámbialo en `index.js`.

---

## 🚀 Guía de Puesta en Marcha (Paso a Paso)

### Paso 1: Instalar dependencias del proyecto
Abre una terminal (PowerShell o CMD) en la carpeta raíz del proyecto y ejecuta:
```bash
npm install
```

---

### Paso 2: Crear y poblar la Base de Datos

Tienes dos formas sencillas de hacerlo:

#### Opción A: Desde la terminal (rápido)
```bash
mysql -u root -p < database.sql
```
*(Si no tienes contraseña configurada en MySQL, presiona `Enter` cuando solicite password).*

#### Opción B: Desde phpMyAdmin (XAMPP)
1. Abre tu navegador e ingresa a `http://localhost/phpmyadmin`.
2. Haz clic en la pestaña **Importar** (en el menú superior).
3. Haz clic en **Seleccionar archivo** y elige el archivo `database.sql` de este proyecto.
4. Desplázate al final y presiona el botón **Importar / Continuar**.

---

### Paso 3: Verificar la conexión a la Base de Datos
Para confirmar que Node.js se comunica correctamente con MySQL y que los datos iniciales existen, ejecuta el script de prueba:

```bash
node probar_db.js
```

**Salida esperada:**
```text
🔄 Verificando tablas y datos en botica_novasalud...

📦 Total de productos en inventario: 11
⚠️ Productos en alerta de reposición: 4
💰 Total de ventas registradas: 2

✅ ¡Todo está configurado y funcionando perfectamente!
```

---

### Paso 4: Iniciar el Servidor Web
Ejecuta:
```bash
npm start
```
*O alternativamente:*
```bash
node index.js
```

El servidor iniciará e indicará:
```text
🚀 Servidor de Botica Nova Salud corriendo en: http://localhost:3000
```

---

### Paso 5: Abrir la Aplicación Web
Abre tu navegador (Google Chrome, Edge, Firefox, Brave) y accede a:
```text
http://localhost:3000
```

---

## 📁 Estructura del Proyecto

```text
Botica_Net/
│
├── public/                   # Frontend estático servido por Express
│   ├── index.html            # Interfaz de usuario (Punto de Venta POS, Alertas, Inventario)
│   ├── estilos.css           # Estilos clínicos modernos, variables y clases Hover.css
│   └── app.js                # Lógica del cliente: fetch API, Anime.js y Web Audio API
│
├── database.sql              # Script DDL de tablas y datos semilla de prueba
├── db.js                     # Conexión asíncrona mediante pool de mysql2/promise
├── database.js               # Export de compatibilidad para requerir db.js
├── probar_db.js              # Script utilitario de verificación rápida de la BD
├── index.js                  # Servidor Express y endpoints de la API REST
├── package.json              # Metadatos del proyecto y dependencias (express, mysql2)
├── PLAN.md                   # Plan maestro con especificaciones y preguntas guías
└── README.md                 # Este manual de instalación y uso
```

---

## 🔌 Especificación de la API REST

| Método | Endpoint | Descripción | Estado HTTP |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/productos` | Retorna el catálogo completo ordenado alfabéticamente. | `200 OK` |
| `GET` | `/api/alertas` | Retorna solo los productos en estado crítico ($stock \le stock\_minimo$). | `200 OK` |
| `POST` | `/api/productos` | Registra un nuevo medicamento en el inventario. | `201 Created` |
| `POST` | `/api/ventas` | Registra una venta, descuenta el stock de forma atómica y guarda el detalle. | `201 Created` |
| `GET` | `/api/ventas` | Retorna el historial de las últimas 15 ventas realizadas. | `200 OK` |

---

## 🛠️ Tecnologías Empleadas

### Backend:
* **Node.js**: Entorno de ejecución en JavaScript del lado del servidor.
* **Express.js**: Framework minimalista para la creación de la API REST y servicio de archivos estáticos.
* **MySQL 2 (`mysql2/promise`)**: Driver de base de datos relacional con soporte nativo para `async/await` y pool de conexiones.

### Frontend:
* **HTML5 Semántico & CSS3 Moderno**: Diseño responsivo y paleta médica profesional.
* **JavaScript ES6+**: Consumo asíncrono de API mediante `fetch()`.
* **Anime.js**: Microanimaciones de tarjetas, modales y conteos numéricos.
* **Hover.css**: Transiciones en botones e interactividad en hover.
* **Web Audio API**: Efectos sonoros generados dinámicamente con osciladores nativos del navegador (bip de clic, alerta de stock y caja registradora de venta).

---

## ❓ Solución a Problemas Frecuentes (FAQ)

### 1. `Error: connect ECONNREFUSED 127.0.0.1:3306`
* **Causa:** El servicio de MySQL no está iniciado.
* **Solución:** Abre el panel de XAMPP y presiona el botón **Start** junto a MySQL.

### 2. `ER_ACCESS_DENIED_ERROR: Access denied for user 'root'@'localhost'`
* **Causa:** La contraseña de MySQL en `db.js` no coincide con la de tu servidor.
* **Solución:** Abre `db.js` y coloca tu contraseña en la propiedad `password`.

### 3. `ER_BAD_DB_ERROR: Unknown database 'botica_novasalud'`
* **Causa:** No se ejecutó el script de creación.
* **Solución:** Importa el archivo `database.sql` ejecutando `mysql -u root -p < database.sql` o mediante phpMyAdmin.

---

## 👨‍💻 Desarrollado por

|  Mateo Vicente | Miguel Córdova |
| :---: | :---: |
| 🚀 FullStack Developer | 🚀 FullStack Developer |
| <picture><img src="https://github.com/mrpeak-1/MiniCientificos-Android/blob/main/.github-assets/programmer.gif?raw=true" width="200" alt="James"></picture> | <picture><img src="https://github.com/mrpeak-1/MiniCientificos-Android/blob/main/.github-assets/programmer.gif?raw=true" width="200" alt="Mateo"></picture> |

<br>

<p align="center">
  <strong>© 2026 Botica_Net+</strong>
</p>

## 📄 Licencia
Proyecto académico bajo licencia ISC.

