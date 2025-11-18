FROM node:18-bullseye AS base
WORKDIR /usr/src/app
RUN apt-get update && \
    apt-get -y install bash curl python3 make g++ wget && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -fr /var/lib/apt/lists/*

FROM base as builder
COPY package*.json /usr/src/app/
WORKDIR /usr/src/app/
ENV NODE_ENV=production
RUN npm ci

FROM base as runner
ENV NODE_ENV=production
COPY . /usr/src/app
WORKDIR /usr/src/app/
COPY --from=builder /usr/src/app/node_modules/ /usr/src/app/node_modules/
ENV DEPLOY_SUBGRAPH=true \
    IPFS=""\
    GRAPH_NODE=""
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]