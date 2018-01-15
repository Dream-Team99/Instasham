FROM node:carbon

EXPOSE 3000

ADD . /

RUN npm install


CMD ["sh", "-c", "npm run start"]