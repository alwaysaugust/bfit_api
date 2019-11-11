## Available Scripts

In the project directory, you can run:

### `npm install`

Run before starting your server

### `node server.js`

To start a nodejs server.

### Launch parameters

`ADMIN_EMAIL` : allowed admin address to approve vendor forms.

`PORT` : server port for calls to be accepted on.

`FRONTEND` : frontend address.

`PUBLIC_ADDRESS` : public address of the api server.

### Production Server Example

1. Launch mongodb `sudo service mongodb start`

2. Start production server by running `ADMIN_EMAIL=oleksiy@alwaysaugust.co PORT=5500 FRONTEND=http://subdomain.exampledomain.com PUBLIC_ADDRESS=http://subdomain.exampledomain.com/api node server.js`

3. Configure webserver to route calls to our nodejs server.
   Nginx example config:

```
server{
    location /api{
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header Host $http_host;
                proxy_set_header X-NginX-Proxy true;

                rewrite ^/bfit/api/?(.*) /$1 break;

                proxy_pass http://123.456.789.321:5500;
                proxy_redirect off;
       }
        [... frontend config below ...]
	    listen 80;
        listen [::]:80;

        root /bfit_ui/build;

        index index.html index.htm index.nginx-debian.html;

        server_name subdomain.exampledomain.com;

        location / {
                [... more frontend config here...]
        }

}

```

\*For Google Login on your domain remeber to add a new Client ID for Web applications at https://console.developers.google.com/apis/credentials for OAUTH2 client and then update `clientID` and `clientSecret` in the server code
