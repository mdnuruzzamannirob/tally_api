FROM node:20-alpine AS dependencies

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .
# Prisma client generation only needs a valid PostgreSQL URL shape; it does not
# connect to the database during the image build. The real DATABASE_URL is
# supplied to the running service by the deployment environment.
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm db:generate && pnpm build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/contracts ./contracts

EXPOSE 5000
USER node
CMD ["node", "dist/server.js"]
