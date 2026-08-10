FROM node:20-alpine AS dependencies

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .
ARG PRISMA_GENERATE_DATABASE_URL
RUN test -n "$PRISMA_GENERATE_DATABASE_URL"
RUN DATABASE_URL="$PRISMA_GENERATE_DATABASE_URL" pnpm prisma:generate && pnpm build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated

EXPOSE 4000
USER node
CMD ["node", "dist/server.js"]

FROM build AS migration

CMD ["pnpm", "db:deploy"]
