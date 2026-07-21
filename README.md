# inventario-app

Catálogo de inventario con interfaz web y base de datos local. Este repositorio es el **punto de partida** de la tarea de CI/CD — no incluye `Dockerfile`, workflow de GitHub Actions ni manifiestos de Kubernetes: esos tres se construyen como parte del trabajo asignado.

## Qué es

Una app Node.js/Express con:

- **Interfaz web** (`public/index.html`, `public/app.js`, `public/styles.css`): una tabla de productos con formulario para agregar y botón para eliminar.
- **Base de datos local** (`db.js`): un archivo JSON en `data/products.json` que persiste los productos entre reinicios del proceso — sin motor de base de datos externo ni dependencias nativas.
- **API REST** consumida por la interfaz.

## Ejecutar en local

```bash
npm install
npm start
# abrir http://localhost:3000
```

## Pruebas

```bash
npm test
```

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /health` | Estado de salud: `200` si el proceso y el archivo de base de datos son accesibles, `500` si no (o si `SIMULATE_FAILURE=true`). |
| `GET /version` | Devuelve `version`, `color` y `hostname` — configurables por variables de entorno `APP_VERSION` / `APP_COLOR`. |
| `GET /api/products` | Lista todos los productos. |
| `GET /api/products/:id` | Devuelve un producto por id. |
| `POST /api/products` | Crea un producto (`name`, `sku`, `stock`, `price`). |
| `PATCH /api/products/:id` | Actualiza campos de un producto. |
| `DELETE /api/products/:id` | Elimina un producto. |
| `GET /` | Sirve la interfaz web. |

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor. |
| `APP_VERSION` | `v1` | Se muestra en `/version` y en el encabezado de la interfaz. |
| `APP_COLOR` | `blue` | Color del encabezado — útil para distinguir versiones en un despliegue. |
| `SIMULATE_FAILURE` | `false` | Si es `true`, `/health` responde siempre `500`. |
| `DB_PATH` | `./data/products.json` | Ruta del archivo de base de datos local. |

---

# Implementación de CI/CD

Durante esta práctica se implementó un flujo completo de Integración Continua y Despliegue Continuo (CI/CD) utilizando Docker, GitHub Actions, GitHub Container Registry (GHCR) y Kubernetes con Minikube.

## Tecnologías utilizadas

- Node.js
- Express
- Docker
- GitHub Actions
- GitHub Container Registry (GHCR)
- Kubernetes
- Minikube

## Docker

Construcción de la imagen:

```bash
docker build -t inventario-app .
```

Ejecución local:

```bash
docker run -p 3000:3000 inventario-app
```

## GitHub Actions

El pipeline realiza automáticamente:

1. Instalación de dependencias (`npm ci`)
2. Ejecución de pruebas (`npm test`)
3. Construcción de la imagen Docker
4. Publicación en GitHub Container Registry (GHCR)

## Kubernetes

Archivos utilizados:

```
k8s/
├── deployment.yml
└── service.yml
```

Despliegue:

```bash
kubectl apply -f k8s/
```

Verificación:

```bash
kubectl get deployments

kubectl get pods

kubectl get services
```

Acceso a la aplicación:

```bash
minikube service inventario-app-service
```

## Rolling Update

Se realizó un Rolling Update modificando la aplicación de:

```
Version v1 (blue)
```

a

```
Version v2 (green)
```

Posteriormente se ejecutó:

```bash
kubectl rollout restart deployment/inventario-app

kubectl rollout status deployment/inventario-app
```

El Deployment reemplazó el Pod anterior por uno nuevo sin necesidad de recrear manualmente el Deployment.

## Prueba de pérdida de datos

Se agregó un producto desde la aplicación.

Posteriormente se eliminó el Pod:

```bash
kubectl delete pod <nombre-del-pod>
```

Kubernetes creó automáticamente un nuevo Pod.

Al ingresar nuevamente a la aplicación se comprobó que el producto agregado había desaparecido, demostrando que los datos se almacenaban dentro del contenedor y no en un volumen persistente.

## Evidencias

Agregar las siguientes capturas:

- Aplicación ejecutándose localmente.
- Docker ejecutando la aplicación.
- GitHub Actions exitoso.
- Imagen publicada en GHCR.
- Deployment en Kubernetes.
- Pods en ejecución.
- Services creados.
- Aplicación desplegada en Minikube.
- Rolling Update.
- Prueba de pérdida de datos.

## Conclusión

Se implementó un pipeline de CI/CD que automatiza la construcción, prueba y publicación de imágenes Docker mediante GitHub Actions y despliega la aplicación en Kubernetes utilizando Minikube.

Flujo implementado:

GitHub → GitHub Actions → Docker → GHCR → Kubernetes → Minikube