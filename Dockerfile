FROM apify/actor-node-playwright-firefox:22-1.64.1

COPY package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && rm -r ~/.npm

COPY . ./

ENV APIFY_LOG_LEVEL=INFO

CMD ["npm", "start", "--silent"]
