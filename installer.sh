#!/bin/bash

REPO_URL="https://github.com/Novattz/creamlinux-installer.git"
INSTALL_DIR="/opt/creamlinux-installer"
WRAPPER_PATH="/usr/local/bin/creamlinux-installer"

# Clone or update the repo
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Cloning creamlinux-installer into $INSTALL_DIR..."
    sudo git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo "Repository already exists at $INSTALL_DIR."
    echo "Pulling latest changes..."
    cd "$INSTALL_DIR" && sudo git pull
fi

# Create or update the wrapper script
echo "Creating/updating wrapper at $WRAPPER_PATH..."
sudo tee "$WRAPPER_PATH" > /dev/null << EOF
#!/bin/bash
python3 $INSTALL_DIR/main.py "\$@"
EOF

# Make it executable
sudo chmod +x "$WRAPPER_PATH"

echo "✅ Done! You can now run 'creamlinux-installer' from anywhere."
