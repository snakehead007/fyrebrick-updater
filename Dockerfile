FROM node:15.11.0
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
RUN npm install -g npm@7.5.4
RUN npm install --save
COPY . /usr/src/app
CMD [ "npm", "start" ]