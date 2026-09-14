#![cfg_attr(
    all(not(debug_assertions), feature = "desktop"),
    windows_subsystem = "windows"
)]

fn main() {
    #[cfg(feature = "desktop")]
    stacks_lib::run();

    #[cfg(not(feature = "desktop"))]
    {
        eprintln!("Desktop binary requires the `desktop` feature");
        std::process::exit(1);
    }
}
