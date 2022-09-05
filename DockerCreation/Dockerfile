FROM alpine/node
WORKDIR /home/node/app
RUN apk update && apk add git
RUN git clone https://github.com/alinebastos/simple-nodejs-server -b master
WORKDIR /home/node/app/simple-nodejs-server
RUN npm install
CMD ["npm", "start"]
