# Checkers Game

This document describes how to run the Checkers game.

## Client-Server Architecture

The Checkers game uses a client-server architecture:

*   **Client:** `checkers.html` (and associated JavaScript, likely in a file like `checkers.js` or embedded within the HTML). This is the part you interact with in your web browser.
*   **Server:** `checkers_server.js`. This is a Node.js application that manages the game state and communication between players.

Communication between the client (browser) and the server (Node.js) is typically handled using WebSockets.

## Prerequisites

To run the Checkers game, you will need the following installed on your computer:

1.  **Node.js:** This is required to run the `checkers_server.js` file. You can download and install it from the official Node.js website: [https://nodejs.org/](https://nodejs.org/)
2.  **A modern web browser:** Any up-to-date browser such as Google Chrome, Mozilla Firefox, Safari, or Microsoft Edge will work.

## Step-by-Step Instructions to Run the Game

Follow these steps to get the Checkers game running:

1.  **Open a terminal or command prompt:**
    *   On Windows, you can search for "Command Prompt" or "PowerShell".
    *   On macOS, you can open "Terminal" (found in Applications > Utilities).
    *   On Linux, you can usually open a terminal with `Ctrl+Alt+T` or find it in your applications menu.

2.  **Navigate to the directory containing the `checkers_server.js` file:**
    Use the `cd` (change directory) command. For example, if your game files are in a folder named `checkers-game` on your Desktop, you might type:
    ```bash
    cd Desktop/checkers-game
    ```
    Replace `Desktop/checkers-game` with the actual path to your game directory.

3.  **Install the 'ws' WebSocket library (if not already done):**
    The server uses a library called 'ws' for WebSocket communication. To install it, run the following command in your terminal (while in the project directory):
    ```bash
    npm install ws
    ```
    This command will download the 'ws' library and place it in a `node_modules` folder within your project directory. You only need to do this once for the project.

4.  **Start the server:**
    Once the 'ws' library is installed (or if it was already installed), start the server by running the following command in your terminal:
    ```bash
    node checkers_server.js
    ```

5.  **Look for a confirmation message in the terminal:**
    If the server starts successfully, you should see a message in the terminal indicating that it's running and listening on a specific port. This message might look something like:
    ```
    WebSocket server started and listening on port 8080
    ```
    or
    ```
    Server listening on port 8080
    ```
    The exact message depends on how `checkers_server.js` is written. This confirms the server is ready.

6.  **Open the `checkers.html` file in a web browser:**
    Navigate to the directory where you saved the game files using your computer's file explorer. Then, you can usually open `checkers.html` by:
    *   Double-clicking the `checkers.html` file.
    *   Right-clicking the file and choosing "Open with" and then selecting your preferred web browser.
    *   Opening your web browser and using the "File > Open" or "File > Open File..." menu to navigate to and select `checkers.html`.

7.  **Play the game:**
    *   **Two players on the same machine:** To play against another person on the same computer, simply open `checkers.html` in a second browser window or a new tab in your existing browser. Each window/tab will act as a separate player. The first window to connect will typically be one color (e.g., Red), and the second will be the other (e.g., Black).
    *   **Two players on different machines (Advanced - for future reference, focusing on local play for now):**
        *   The other player would also need to open `checkers.html` in their browser.
        *   **Important:** The client-side JavaScript code (in `checkers.js` or within `checkers.html`) that establishes the WebSocket connection (e.g., `new WebSocket('ws://localhost:8080')`) would need to be modified. The `localhost` part tells the client to connect to a server on the *same machine*. To connect to a server on a *different machine*, `localhost` must be replaced with the IP address or hostname of the machine running `checkers_server.js`. For example, if the server is on a machine with IP address `192.168.1.100`, the connection line would change to `new WebSocket('ws://192.168.1.100:8080')`. Both players' machines must be on the same network, and firewalls might need to be configured to allow the connection.

## Troubleshooting Networking Issues

If you encounter problems running the game, especially when trying to connect clients or when the server doesn't seem to start correctly, here are some common troubleshooting steps:

1.  **Check Node.js Installation:**
    *   Ensure Node.js is installed correctly. Open your terminal and type:
        ```bash
        node -v
        ```
    *   This should print your Node.js version (e.g., `v18.12.1`). If you get an error, you need to install or re-install Node.js.

2.  **Verify 'ws' Library Installation:**
    *   The 'ws' library is required for WebSocket communication and should be installed locally within your project directory.
    *   Check if a `node_modules` folder exists in your project directory. Inside `node_modules`, you should find a `ws` folder.
    *   Alternatively, you can try listing the installed packages for the project. In your terminal (in the project directory), run:
        ```bash
        npm list ws
        ```
    *   If it's installed, it will show the version. If not, or if you see errors, re-run `npm install ws`.

3.  **Browser Developer Console for WebSocket Errors:**
    *   If the game page loads but doesn't connect to the server, open your browser's developer console. You can usually do this by pressing the `F12` key or right-clicking on the page and selecting "Inspect" or "Inspect Element," then navigating to the "Console" tab.
    *   Look for error messages, particularly those related to WebSocket connections. An error like `"WebSocket connection to 'ws://localhost:8080/' failed"` indicates the client (browser) could not connect to the server.
    *   This could be because the server isn't running, is running on a different port, or a firewall is blocking the connection.

4.  **Port Already in Use (EADDRINUSE error):**
    *   When you try to start the server (`node checkers_server.js`), you might see an error in the terminal like `Error: listen EADDRINUSE: address already in use :::8080`.
    *   This means another application on your computer is already using port 8080.
    *   **Solution:** You can either stop the other application or change the port for the Checkers game.
        *   **To change the port:**
            1.  **Server-side:** Open `checkers_server.js` in a text editor. Find the line where the port is defined (e.g., `const port = 8080;` or `server.listen(8080)`). Change `8080` to a different port number (e.g., `8081`).
            2.  **Client-side:** You *must* also update the port number in the client-side JavaScript that connects to the WebSocket. This code is likely in `checkers.js` or embedded in `checkers.html`. Find the line similar to `const socket = new WebSocket('ws://localhost:8080');` and change `8080` to the new port number you chose (e.g., `ws://localhost:8081`).
            3.  Save both files and try starting the server and opening `checkers.html` again.

5.  **Firewall Issues:**
    *   Firewalls (either built-in to your operating system or third-party software) can sometimes block Node.js applications or network connections on specific ports.
    *   **Check your firewall settings:**
        *   Ensure that Node.js (`node.exe` on Windows, or the `node` process on macOS/Linux) is allowed to make network connections.
        *   Ensure that the port you are using for the game (e.g., 8080) is not blocked for incoming/outgoing connections.
    *   The steps to configure your firewall vary depending on your operating system and any third-party firewall software you use. Consult your firewall's documentation for specific instructions. You might need to add an exception for Node.js or the port.

Enjoy playing Checkers! If you encounter any issues, double-check that the server is running and that you've followed all the steps.

## Optional: Using Nginx as a Reverse Proxy

For more advanced setups, you might consider using Nginx as a reverse proxy in front of your Node.js Checkers server. This is **not required** for basic local play but can offer several benefits in a production-like environment or when you want to expose the game more robustly:

*   **Serving Static Files:** Nginx is highly efficient at serving static files like `checkers.html`, CSS, and client-side JavaScript.
*   **SSL Termination:** Nginx can handle HTTPS, encrypting traffic between the players and the server, which is crucial for security if the game is accessible over the internet.
*   **Easier Port Management:** You can run Nginx on standard ports (like 80 for HTTP or 443 for HTTPS) and proxy requests to your Node.js server running on a non-standard port (like 8080).
*   **Load Balancing:** While not applicable for this single-server game, Nginx can act as a load balancer for applications with multiple backend servers.

**Prerequisites:**

*   Nginx installed and running on your server.
*   Your Checkers game files (including `checkers_server.js` and `checkers.html`) accessible by Nginx.

**Basic Nginx Configuration Example:**

Below is a basic example of an Nginx server block configuration. You would typically place this in a file within Nginx's configuration directory (e.g., `/etc/nginx/sites-available/checkers` on Ubuntu, then symlink it to `sites-enabled`).

```nginx
server {
    listen 80; # Listen on port 80 (HTTP)
    server_name your_domain_or_server_ip; # Replace with your domain or IP

    # Root directory for static files (checkers.html, .css, .js)
    # Adjust the path to where your game's client files are located.
    root /var/www/html/checkers-game; # Or e.g., /path/to/your/checkers-game/client
    index checkers.html;

    location / {
        # Try to serve the requested file directly, otherwise show checkers.html
        try_files $uri $uri/ /checkers.html;
    }

    # Location for WebSocket proxy
    location /ws/ {
        proxy_pass http://localhost:8080; # Assuming your Node.js server runs on port 8080
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Explanation:**

*   `listen 80;`: Nginx listens for incoming HTTP connections on port 80.
*   `server_name your_domain_or_server_ip;`: Replace this with the actual domain or IP address you'll use to access the game.
*   `root /var/www/html/checkers-game;`: This should be the path to the directory containing `checkers.html` and any other client-side assets (like CSS or JavaScript files). **Adjust this path to match your setup.**
*   `location / { ... }`: This block tells Nginx how to serve static files. Requests for `/` will serve `checkers.html`.
*   `location /ws/ { ... }`: This is crucial for WebSockets.
    *   Any request to `http://your_domain_or_server_ip/ws/` will be proxied to the Node.js server.
    *   `proxy_pass http://localhost:8080;` forwards the request to your Node.js server running on port 8080. If your `checkers_server.js` runs on a different port, update it here.
    *   The `proxy_set_header` directives are necessary for WebSocket connections to work correctly through a reverse proxy.

**Client-Side JavaScript Change:**

If you set up Nginx like this, you **must** update the WebSocket URL in your client-side JavaScript (likely in `checkers.js` or embedded in `checkers.html`).

Instead of connecting directly to the Node.js server's port:
```javascript
// const socket = new WebSocket('ws://localhost:8080'); // Old direct connection
```
You would change it to connect to Nginx's WebSocket proxy path:
```javascript
// const socket = new WebSocket('ws://your_domain_or_server_ip/ws/'); // New Nginx connection
```
Make sure the protocol is `ws://` (or `wss://` if you configure SSL in Nginx) and it points to the correct domain/IP and the `/ws/` path.

**Important Considerations:**

*   This is a simplified example. Production Nginx configurations can be more complex, especially when setting up HTTPS/SSL.
*   Ensure Nginx has the necessary permissions to read the static files.
*   After modifying Nginx configuration, you typically need to test it (`sudo nginx -t`) and then reload or restart the Nginx service (`sudo systemctl reload nginx` or `sudo systemctl restart nginx`).
*   Refer to the official Nginx documentation for detailed information on installation and configuration.

Setting up Nginx is an advanced topic beyond the scope of simply running the Checkers game locally, but it's a common pattern for deploying web applications.
