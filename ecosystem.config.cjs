module.exports = {
  apps: [{
    name: "basewa",
    script: "index.js",
    node_args: ["--no-warnings"],
    env: {
      NODE_TLS_REJECT_UNAUTHORIZED: "0"
    }
  }]
};