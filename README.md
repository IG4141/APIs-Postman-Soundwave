# Creación de APIs y Testeo con Postman

---

## Descripción

Se implementaron tres nuevos endpoints en el archivo `index.js` del proyecto Soundwave, agregados debajo del `GET /api/catalogo` ya existente. Cada escritura en PostgreSQL dispara una limpieza de caché en Redis mediante `redisClient.flushDb()`.

---

## Prueba 1 — POST /api/artistas (Crear artista)

**Método:** POST  
**URL:** `http://localhost:3000/api/artistas`  
**Body → raw → JSON:**
```json
{
    "nombre": "Daft Punk",
    "biografia": "Dúo francés pionero de la música electrónica.",
    "id_genero": 2
}
```

**Resultado:** 

<img width="927" height="269" alt="entrega 1" src="https://github.com/user-attachments/assets/11647cf2-72b9-4937-8db6-ac9f70ed29fc" />

---

## Prueba 2 — PUT /api/canciones/1 (Actualizar canción, ID válido)

**Método:** PUT  
**URL:** `http://localhost:3000/api/canciones/1`  
**Body → raw → JSON:**
```json
{
    "duracion_segundos": 240
}
```

**Resultado:** 

<img width="924" height="275" alt="entrega 2" src="https://github.com/user-attachments/assets/deb25e4e-5d47-4677-b9ee-8f212f31e11f" />


---

## Prueba 3 — PUT /api/canciones/9999 (Forzar error 404)

**Método:** PUT  
**URL:** `http://localhost:3000/api/canciones/9999`  
**Body → raw → JSON:** (mismo que prueba 2)

**Resultado:** 

<img width="928" height="193" alt="entrega 3" src="https://github.com/user-attachments/assets/b62f52c0-2a5a-4cba-a9a6-8e766cd4ae7e" />
---

## Prueba 4 — DELETE /api/playlists/1 (Baja lógica)

**Preparación en pgAdmin:**
```sql
ALTER TABLE playlist ADD COLUMN activo BOOLEAN DEFAULT TRUE;
```

**Método:** DELETE  
**URL:** `http://localhost:3000/api/playlists/1`  
**Sin body.**

**Resultado:**

<img width="922" height="216" alt="entrega 4" src="https://github.com/user-attachments/assets/7c6d8603-0016-4193-b187-e1c6f46719f5" />

---

## Tarea de Investigación

En el proyecto ya usamos claves específicas para el caché del catálogo, por ejemplo `catalogo:page:1:limit:20`. En lugar de usar `redisClient.flushDb()` que borra toda la RAM, podríamos usar `redisClient.del(cacheKey)` para borrar únicamente esa clave del catálogo, dejando intactas las sesiones y demás datos guardados en Redis.
```
const cacheKey = `catalogo:page:1:limit:20`;
await redisClient.del(cacheKey);
```
