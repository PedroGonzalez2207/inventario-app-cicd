# inventario-app

Catalogo de inventario con interfaz web, API REST y base de datos local en archivo JSON.

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
