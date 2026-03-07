# PulseOps Change Log

## 2026-03-01
- Updated `pulseops-api/src/config/app.json` CORS origins to include both UI hosts (`http://localhost:3000` and `http://localhost:3001`) so either frontend can call the API without browser rejections.
- Pointed `pulseops-ui/src/shared/config/urls.json` base/endpoint URLs to `http://localhost:4001/api` to match the running backend port when PulseOps V1 and V2 run in parallel.
