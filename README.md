# inventario-app

Catalogo de inventario con interfaz web, API REST y base de datos local en archivo JSON.

## Objetivo

Esta práctica implementa un pipeline completo de Integración Continua y Despliegue Continuo (CI/CD) utilizando Docker, GitHub Actions, GitHub Container Registry (GHCR) y Kubernetes (Minikube). Se implementó un despliegue base mediante Rolling Update y una estrategia Canary utilizando únicamente recursos nativos de Kubernetes, además de componentes adicionales como Kubernetes Secrets, Trivy y Startup Delay.

---

## Tecnologías

| Tecnología | Uso |
|------------|-----|
| Node.js | Backend |
| Express | API REST |
| Docker | Contenedores |
| GitHub Actions | CI/CD |
| GHCR | Registro de imágenes |
| Kubernetes | Orquestación |
| Minikube | Clúster local |
| Trivy | Escaneo de vulnerabilidades |

---

## Arquitectura

```text
Usuario
   │
   ▼
Service
   │
   ▼
Deployment
   │
 ┌──────────────┐
 │              │
Pod 1       Pod 2
 │              │
Inventario App
 │
products.json
```

---

## Ejecutar en local

```bash
npm install
npm start
```

## Pruebas

```bash
npm test
```

## Endpoints principales

- `GET /`
- `GET /health`
- `GET /version`
- `GET /api/products`

---

## Docker

Se implementó un Dockerfile multi-stage:

- Builder: instala dependencias y ejecuta `npm test`.
- Runtime: copia únicamente los archivos necesarios para ejecutar la aplicación.
- Si las pruebas fallan, la construcción de la imagen también falla.

```bash
docker build -t inventario-app .
docker run -p 3000:3000 inventario-app
```

Verificación:

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/version
curl http://localhost:3000/api/products
```

---

## Pipeline CI/CD

El workflow implementa dos etapas:

1. Checkout del repositorio.
2. Configuración de Node.js.
3. Instalación de dependencias (`npm ci`).
4. Ejecución de pruebas (`npm test`).
5. Construcción de la imagen Docker.
6. Escaneo con Trivy.
7. Publicación en GHCR con etiquetas `latest` y `SHA`.

Se sigue el principio **Fail Fast**, por lo que la imagen solo se publica si las pruebas y el análisis de seguridad finalizan correctamente.

---

## Despliegue base

La practica mantiene el despliegue base de Persona 1 con:

- Dockerfile multi-stage
- pipeline CI/CD en GitHub Actions
- publicacion en GHCR con etiquetas `latest` y `SHA`
- `k8s/deployment.yml`
- `k8s/service.yml`
- RollingUpdate con `maxUnavailable: 1` y `maxSurge: 1`
- readiness y liveness sobre `/health`
- `STARTUP_DELAY_SECONDS=15`

### Rolling Update

Permite actualizar la aplicación sin interrumpir completamente el servicio, reemplazando Pods de forma gradual.

### Readiness y Liveness

- Readiness Probe: determina cuándo un Pod puede recibir tráfico.
- Liveness Probe: reinicia automáticamente un Pod que deja de responder.

### Startup Delay

La variable `STARTUP_DELAY_SECONDS=15` simula una aplicación con arranque lento para demostrar el funcionamiento correcto de la Readiness Probe.

---

## Persona 2: Canary

Se implemento una estrategia Canary separada del deployment base en `k8s/canary/`.

- Stable: `k8s/canary/deployment-stable.yml`
- Canary: `k8s/canary/deployment-canary.yml`
- Service: `k8s/canary/service.yml`

La ruta `/version` diferencia Stable y Canary porque devuelve `version` y `color`.

- Stable usa `APP_VERSION=v1` y `APP_COLOR=stable`
- Canary usa `APP_VERSION=v2` y `APP_COLOR=canary`

El reparto se logra con:

- 4 pods Stable con labels `app: inventario-app-canary` y `track: stable`
- 1 pod Canary con labels `app: inventario-app-canary` y `track: canary`
- 1 Service con selector solo `app: inventario-app-canary`

Eso expone la version nueva a una parte reducida del trafico. Con 4 pods Stable y 1 pod Canary, la distribucion esperada es aproximadamente 80/20, pero no es exacta ni garantizada.

### Justificación

Se eligió Canary porque permite validar una nueva versión con una pequeña fracción del tráfico antes de promoverla completamente, reduciendo el riesgo frente a un despliegue tradicional.

## Secret de Kubernetes

Crear el Secret local:

```bash
kubectl create secret generic inventario-app-secret --from-literal=API_KEY="<API_KEY_LOCAL>"
```

Los deployments Stable y Canary consumen `API_KEY` mediante `secretKeyRef`. El valor no se guarda en Git.

## Desplegar Canary

```bash
kubectl apply -f k8s/canary/deployment-stable.yml
kubectl apply -f k8s/canary/deployment-canary.yml
kubectl apply -f k8s/canary/service.yml
kubectl rollout status deployment/inventario-app-stable
kubectl rollout status deployment/inventario-app-canary
```

## Verificar

```bash
kubectl get deployments
kubectl get pods --show-labels
kubectl get pods -l app=inventario-app-canary,track=stable
kubectl get pods -l app=inventario-app-canary,track=canary
kubectl get service inventario-app-canary-service
kubectl get endpoints inventario-app-canary-service
minikube service inventario-app-canary-service --url
```

Comprobar el Secret sin revelar el valor:

```bash
POD=$(kubectl get pods -l app=inventario-app-canary -o jsonpath="{.items[0].metadata.name}")
kubectl exec "$POD" -- node -e "console.log('API_KEY configurada:', Boolean(process.env.API_KEY))"
```

## Trivy en GitHub Actions

En `.github/workflows/ci-cd.yml`, el job `build-push`:

1. construye la imagen localmente con la etiqueta `${{ github.sha }}`
2. ejecuta Trivy antes de cualquier push
3. analiza vulnerabilidades de sistema operativo y librerias
4. filtra severidad `CRITICAL`
5. falla con `exit-code: 1` si encuentra vulnerabilidades criticas
6. publica `SHA` y `latest` solo si Trivy pasa

En `pull_request` solo corre pruebas y no publica imagenes.

## Rollback

```bash
kubectl scale deployment inventario-app-canary --replicas=0
kubectl scale deployment inventario-app-stable --replicas=4
```

## Limpieza

```bash
kubectl delete -f k8s/canary/
kubectl delete secret inventario-app-secret
```

## Limitacion de persistencia

Canary no resuelve la perdida de datos. Cada pod sigue usando almacenamiento local, asi que recrear pods puede eliminar cambios no persistidos aunque el reparto de trafico funcione.

## Conclusiones

Se implementó un flujo CI/CD funcional con Docker, GitHub Actions y Kubernetes, incorporando buenas prácticas de despliegue, seguridad y disponibilidad mediante Rolling Update, Canary, Kubernetes Secrets y Trivy.
