cmake_minimum_required(VERSION 3.16)
project(SnakeRealismCpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(snake_cpp src/main.cpp)
target_link_libraries(snake_cpp PRIVATE ncursesw)
