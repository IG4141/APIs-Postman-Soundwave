const express = require('express');
const { createClient } = require('redis');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const PORT = 3000;
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'soundwave_db',
    password: 'SQL123',
    port: 5432,
});
const redisClient = createClient({
    url: 'redis://127.0.0.1:6379'
});
redisClient.on('error', (err) => console.log('Error en Redis Client', err));
redisClient.connect().then(() => console.log('Conectado exitosamente a Redis'));
app.use(cors());
app.use(express.json());

app.get('/api/catalogo', async (req, res) => {
    try {
        // 1. Capturamos qué página pide el frontend (por defecto la pág 1, de a 20 items)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        // Calculamos desde dónde empezar a traer datos en la DB (Offset)
        const offset = (page - 1) * limit;

        // 2. Creamos una Clave Única para esta página en Redis.
        // Ej: "catalogo:page:1:limit:20"
        const cacheKey = `catalogo:page:${page}:limit:${limit}`;

        // 3. INTENTO DE LECTURA (Caché): Le preguntamos a Redis si ya tiene esta página
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData) {
            // Si los datos estaban en la RAM
            console.log(`Sirviendo página ${page} desde Redis`);
            return res.json(JSON.parse(cachedData)); 
        }

        // 4. Si Redis no los tenía, vamos a buscarlo a PostgreSQL
        console.log(`Sirviendo página ${page} desde PostgreSQL (Disco)`);
        const result = await pool.query(
            'SELECT * FROM obtener_catalogo_completo() LIMIT $1 OFFSET $2', 
            [limit, offset]
        );

        // 5. ESCRITURA EN CACHÉ: Guardamos el resultado en Redis para la próxima vez.
        // setEx guarda la clave y le pone un tiempo de vida (TTL) de 60 segundos.
        await redisClient.setEx(cacheKey, 60, JSON.stringify(result.rows));

        // 6. Finalmente, devolvemos las 20 canciones al usuario
        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
});

// POST: Crear un nuevo Artista
app.post('/api/artistas', async (req, res) => {
    // 1. Capturamos los datos que viajan en el Body de la petición
    const { nombre, biografia, id_genero } = req.body;
    try {
        // 2. Sentencia SQL pura para insertar el registro
        const query = `
            INSERT INTO artista (nombre, biografia, id_genero) 
            VALUES ($1, $2, $3) 
            RETURNING *;
        `;
        const result = await pool.query(query, [nombre, biografia, id_genero]);
        
        // 3. Sincronización: Vaciamos Redis porque el catálogo de artistas cambió
        await redisClient.flushDb(); 
        console.log('Caché de Redis limpia tras insertar un nuevo artista.');

        // 4. Respondemos al cliente con el código 201 (Creado) y el objeto resultante
        res.status(201).json({
            mensaje: 'Artista creado exitosamente',
            artista: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno al crear el artista' });
    }
});

// PUT: Actualizar la duración de una canción
app.put('/api/canciones/:id', async (req, res) => {
    const id_cancion = req.params.id; // Capturado de la URL
    const { duracion_segundos } = req.body; // Capturado del Body
    try {
        // Sentencia SQL pura para actualizar
        const query = `
            UPDATE cancion 
            SET duracion_segundos = $1 
            WHERE id_cancion = $2 
            RETURNING *;
        `;
        const result = await pool.query(query, [duracion_segundos, id_cancion]);

        // Si rowCount es 0, significa que el ID enviado no existía en la tabla
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Canción no encontrada' });
        }

        // Sincronización: Vaciamos Redis para romper el caché viejo
        await redisClient.flushDb();
        console.log(`Caché de Redis limpiada tras actualizar la canción ID: ${id_cancion}`);

        res.json({
            mensaje: 'Canción actualizada correctamente',
            cancion: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno al actualizar la canción' });
    }
});

// DELETE (Baja Lógica): "Eliminar" una playlist cambiándole el estado
app.delete('/api/playlists/:id', async (req, res) => {
    const id_playlist = req.params.id;
    try {
        // En lugar de borrar la fila, actualizamos la columna 'activo' a FALSE
        const query = `
            UPDATE playlist 
            SET activo = FALSE 
            WHERE id = $1 
            RETURNING *;
        `;
        const result = await pool.query(query, [id_playlist]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Playlist no encontrada' });
        }

        // Sincronización: Limpiamos la caché de Redis para que el catálogo 
        // no muestre esta playlist que acaba de ser "desactivada"
        await redisClient.flushDb();

        res.json({ 
            mensaje: `Playlist con ID ${id_playlist} dada de baja exitosamente`,
            playlist: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno al dar de baja la playlist' });
    }
});

app.listen(PORT, () => {
    console.log('-------------------------------------------');
    console.log(`✅ Servidor ON: http://localhost:${PORT}`);
    console.log('-------------------------------------------');
});