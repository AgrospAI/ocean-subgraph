FROM node:18-bullseye AS base
WORKDIR /usr/src/app
RUN apt-get update && \
    apt-get -y install bash curl python3 make g++ wget && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -fr /var/lib/apt/lists/*

FROM base AS builder
COPY ./ocean-subgraph/package*.json /usr/src/app/

WORKDIR /usr/src/app/
# ENV NODE_ENV=production # Enabling this skips devDependencies => Doesn't work
RUN npm ci --only=production

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /usr/src/app/
COPY --from=builder /usr/src/app/node_modules/ ./node_modules/
COPY ./ocean-subgraph/ /usr/src/app
ENV DEPLOY_SUBGRAPH=true \
    IPFS=""\
    GRAPH_NODE=""
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]