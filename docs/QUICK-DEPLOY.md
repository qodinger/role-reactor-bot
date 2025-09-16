# Quick Deployment Reference

## Deploy Latest Version
```bash
pnpm run deploy:latest
```

## Deploy with Detailed Output
```bash
pnpm run deploy:latest:verbose
```

## Force Deploy (if stuck)
```bash
pnpm run deploy:latest:force
```

## Check Status After Deploy
```bash
docker ps | grep role-reactor-bot
docker logs role-reactor-bot --tail 20
```

## That's it! 🚀

For more details, see [DEPLOYMENT.md](./DEPLOYMENT.md)
