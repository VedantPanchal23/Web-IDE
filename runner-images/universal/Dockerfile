# Universal Development Environment
# All languages in one container - Production Ready
FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies and tools
RUN apt-get update && apt-get install -y \
    # Essential tools
    curl wget git vim nano bash zsh \
    build-essential cmake ninja-build \
    ca-certificates gnupg lsb-release \
    software-properties-common \
    apt-transport-https \
    # Python dependencies
    python3 python3-pip python3-venv python3-dev \
    # PHP
    php php-cli php-common php-curl php-json php-mbstring php-xml php-zip \
    # Ruby
    ruby ruby-dev bundler \
    # Perl
    perl cpanminus \
    # Lua
    lua5.4 luarocks \
    # R language
    r-base r-base-dev \
    # Additional tools
    make automake autoconf libtool pkg-config \
    zip unzip tar gzip bzip2 xz-utils \
    net-tools iputils-ping telnet \
    htop tree ncurses-bin \
    sudo less man-db bc \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Java (OpenJDK 17)
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk maven gradle \
    && rm -rf /var/lib/apt/lists/*

# Install C/C++ compilers
RUN apt-get update && apt-get install -y \
    g++ gcc gdb valgrind clang lldb \
    && rm -rf /var/lib/apt/lists/*

# Install Go (v1.21)
RUN wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz \
    && rm go1.21.5.linux-amd64.tar.gz

# Install Rust (stable)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && /root/.cargo/bin/rustup default stable

# Install Swift
RUN wget https://download.swift.org/swift-5.9.1-release/ubuntu2204/swift-5.9.1-RELEASE/swift-5.9.1-RELEASE-ubuntu22.04.tar.gz \
    && tar -xzf swift-5.9.1-RELEASE-ubuntu22.04.tar.gz -C /opt \
    && rm swift-5.9.1-RELEASE-ubuntu22.04.tar.gz

# Install Kotlin
RUN curl -s https://get.sdkman.io | bash \
    && bash -c "source /root/.sdkman/bin/sdkman-init.sh && sdk install kotlin"

# Install Scala
RUN wget https://downloads.lightbend.com/scala/2.13.12/scala-2.13.12.tgz \
    && tar -xzf scala-2.13.12.tgz -C /usr/local \
    && rm scala-2.13.12.tgz \
    && ln -s /usr/local/scala-2.13.12/bin/* /usr/local/bin/

# Install Dart
RUN wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/dart.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/download.dartlang.org/linux/debian stable main' | tee /etc/apt/sources.list.d/dart_stable.list \
    && apt-get update && apt-get install -y dart \
    && rm -rf /var/lib/apt/lists/*

# Install Haskell
RUN curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | BOOTSTRAP_HASKELL_NONINTERACTIVE=1 BOOTSTRAP_HASKELL_GHC_VERSION=recommended BOOTSTRAP_HASKELL_CABAL_VERSION=recommended BOOTSTRAP_HASKELL_INSTALL_STACK=1 BOOTSTRAP_HASKELL_INSTALL_HLS=0 sh

# Install Elixir & Erlang (using Ubuntu repositories - more reliable)
RUN apt-get update && apt-get install -y erlang elixir \
    && rm -rf /var/lib/apt/lists/*

# Install Groovy
RUN curl -s get.sdkman.io | bash \
    && bash -c "source /root/.sdkman/bin/sdkman-init.sh && sdk install groovy"

# Install global npm packages
RUN npm install -g \
    typescript ts-node @types/node \
    nodemon pm2 \
    eslint prettier \
    yarn pnpm \
    create-react-app create-next-app \
    coffee-script

# Install common Python packages
RUN pip3 install --no-cache-dir \
    requests urllib3 \
    numpy pandas matplotlib \
    flask fastapi uvicorn \
    django \
    pytest pylint black autopep8 \
    jupyter notebook ipython

# Install Ruby gems
RUN gem install bundler rails sinatra rake minitest

# Install Composer (PHP package manager)
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install Perl modules
RUN cpanm --notest Moose Plack DBI DBD::SQLite JSON::XS

# Install R packages
RUN R -e "install.packages(c('ggplot2', 'dplyr', 'tidyr', 'jsonlite'), repos='https://cran.rstudio.com/')"

# Create workspace directory with proper permissions
RUN mkdir -p /workspace && chmod 777 /workspace

# Set up workspace
WORKDIR /workspace

# Comprehensive environment variables for all languages
ENV PYTHONUNBUFFERED=1 \
    NODE_ENV=development \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    GOROOT=/usr/local/go \
    GOPATH=/root/go \
    CARGO_HOME=/root/.cargo \
    RUSTUP_HOME=/root/.rustup \
    SWIFT_HOME=/opt/swift-5.9.1-RELEASE-ubuntu22.04 \
    DART_HOME=/usr/lib/dart \
    GHC_HOME=/root/.ghcup \
    SDKMAN_DIR=/root/.sdkman \
    SCALA_HOME=/usr/local/scala-2.13.12 \
    TERM=xterm-256color \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

# Unified PATH with all language binaries
ENV PATH="/root/.cargo/bin:/usr/local/go/bin:$GOPATH/bin:$SWIFT_HOME/usr/bin:$DART_HOME/bin:$GHC_HOME/bin:$SDKMAN_DIR/bin:$SCALA_HOME/bin:/usr/local/bin:/usr/bin:/bin:$JAVA_HOME/bin:$PATH"

# Create python and pip symlinks (professional IDE standard)
RUN ln -sf /usr/bin/python3 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

# Configure professional bash environment
RUN echo 'export PS1="\[\033[01;32m\]\u@ai-ide\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> /etc/bash.bashrc && \
    echo 'cd /workspace 2>/dev/null || true' >> /etc/bash.bashrc

# Keep container running
CMD ["/bin/bash", "-c", "while true; do sleep 3600; done"]
