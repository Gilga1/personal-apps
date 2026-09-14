#[cfg(feature = "server")]
#[tokio::main]
async fn main() {
    stacks_lib::server::run_server().await;
}

#[cfg(not(feature = "server"))]
fn main() {
    eprintln!("stacks-server requires --features server");
    std::process::exit(1);
}
