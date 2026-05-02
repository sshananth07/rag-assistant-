#!/bin/sh
cd /app/apps/api
pnpm db:migrate
pnpm dev