#include <algorithm>
#include <array>
#include <chrono>
#include <deque>
#include <fstream>
#include <random>
#include <string>
#include <vector>

#include <ncurses.h>

struct Vec2 {
    int x;
    int y;
    bool operator==(const Vec2& o) const { return x == o.x && y == o.y; }
};

enum class Dir { Up, Down, Left, Right };

struct Level {
    std::string name;
    int colorTheme;
};

struct Game {
    static constexpr int W = 78;
    static constexpr int H = 26;
    static constexpr int APPLES_TO_WIN = 10;

    std::vector<Level> levels{
        {"Wnetrze wulkanu", 1}, {"Las elfow", 2}, {"Kosmos", 3}, {"Zimowe gory", 4},
        {"Tropikalna wyspa", 5}, {"Fabryka lodow", 6}, {"Stadion pilkarski", 7}, {"Miasteczko westernowe", 8},
        {"Statek wycieczkowy", 9}, {"Zamek smoka", 10}};

    std::deque<Vec2> snake;
    Vec2 apple{20, 10};
    std::vector<Vec2> obstacles;
    std::vector<Vec2> fireTiles;

    Dir dir = Dir::Right;
    Dir nextDir = Dir::Right;

    int unlockedLevel = 1;
    int selectedLevel = 1;
    int currentLevel = 1;
    int apples = 0;
    int brightness = 100;
    int snakeSkin = 0;
    bool running = false;
    bool paused = false;
    bool gameOver = false;

    float stepSeconds = 0.12f;
    float fireTimer = 0.0f;
    int firePattern = 0;

    std::mt19937 rng{std::random_device{}()};

    void loadProgress() {
        std::ifstream in("snake_cpp_save.dat");
        if (in) {
            in >> unlockedLevel;
            unlockedLevel = std::clamp(unlockedLevel, 1, 10);
        }
    }

    void saveProgress() {
        std::ofstream out("snake_cpp_save.dat", std::ios::trunc);
        out << unlockedLevel;
    }

    void initSnake() {
        snake.clear();
        snake.push_back({8, H / 2});
        snake.push_back({7, H / 2});
        snake.push_back({6, H / 2});
        dir = Dir::Right;
        nextDir = Dir::Right;
    }

    bool occupied(const Vec2& p) const {
        return std::find(snake.begin(), snake.end(), p) != snake.end() ||
               std::find(obstacles.begin(), obstacles.end(), p) != obstacles.end() ||
               std::find(fireTiles.begin(), fireTiles.end(), p) != fireTiles.end();
    }

    void spawnApple() {
        std::uniform_int_distribution<int> dx(1, W - 2), dy(1, H - 2);
        for (int i = 0; i < 1000; ++i) {
            Vec2 p{dx(rng), dy(rng)};
            if (!occupied(p)) {
                apple = p;
                return;
            }
        }
    }

    void buildObstacles(int level) {
        obstacles.clear();
        int count = 7 + level * 2;
        for (int i = 0; i < count; ++i) {
            int x = 4 + (i * 9 + level * 5) % (W - 8);
            int y = 3 + (i * 5 + level * 7) % (H - 6);
            if (x < 12 && y == H / 2) continue;
            obstacles.push_back({x, y});
        }
    }

    void startLevel(int level) {
        currentLevel = level;
        apples = 0;
        stepSeconds = std::max(0.045f, 0.12f - (level - 1) * 0.007f);
        fireTimer = 0.f;
        firePattern = 0;
        fireTiles.clear();
        initSnake();
        buildObstacles(level);
        spawnApple();
        running = true;
        paused = false;
        gameOver = false;
    }

    void updateFire(float dt) {
        fireTiles.clear();
        if (currentLevel != 10) return;
        fireTimer += dt;
        if (fireTimer >= 10.0f) {
            fireTimer = 0.f;
            firePattern = (firePattern + 1) % 4;
        }
        Vec2 dragon{W - 8, 4};
        static const std::array<std::array<Vec2, 3>, 4> patterns{{
            {{{-1, 0}, {-2, 0}, {-3, 0}}},
            {{{-1, -1}, {-2, -1}, {-3, -1}}},
            {{{-1, 1}, {-2, 1}, {-3, 1}}},
            {{{-1, 0}, {-2, 1}, {-3, -1}}}
        }};
        for (auto p : patterns[firePattern]) {
            Vec2 f{dragon.x + p.x, dragon.y + p.y};
            if (f.x > 0 && f.x < W - 1 && f.y > 0 && f.y < H - 1) fireTiles.push_back(f);
        }
    }

    void advance() {
        if (!running || paused || gameOver) return;
        dir = nextDir;
        Vec2 head = snake.front();
        if (dir == Dir::Up) head.y--;
        if (dir == Dir::Down) head.y++;
        if (dir == Dir::Left) head.x--;
        if (dir == Dir::Right) head.x++;

        auto hit = [&](const Vec2& p) {
            return p.x <= 0 || p.x >= W - 1 || p.y <= 0 || p.y >= H - 1 ||
                   std::find(snake.begin(), snake.end(), p) != snake.end() ||
                   std::find(obstacles.begin(), obstacles.end(), p) != obstacles.end() ||
                   std::find(fireTiles.begin(), fireTiles.end(), p) != fireTiles.end();
        };

        if (hit(head)) {
            gameOver = true;
            running = false;
            return;
        }

        snake.push_front(head);
        if (head == apple) {
            apples++;
            if (apples >= APPLES_TO_WIN) {
                running = false;
                if (currentLevel < 10 && unlockedLevel == currentLevel) {
                    unlockedLevel++;
                    saveProgress();
                }
            } else {
                spawnApple();
            }
        } else {
            snake.pop_back();
        }
    }
};

static void initColors() {
    start_color();
    use_default_colors();
    init_pair(1, COLOR_RED, -1);
    init_pair(2, COLOR_GREEN, -1);
    init_pair(3, COLOR_CYAN, -1);
    init_pair(4, COLOR_WHITE, -1);
    init_pair(5, COLOR_YELLOW, -1);
    init_pair(6, COLOR_MAGENTA, -1);
}

static void drawBackground(const Game& g, float t) {
    const int level = g.currentLevel;
    for (int y = 1; y < Game::H - 1; ++y) {
        for (int x = 1; x < Game::W - 1; ++x) {
            chtype ch = ' ';
            int color = 4;

            if (level == 2 && (x + y * 2) % 17 == 0 && y > Game::H / 2) {
                ch = '^'; color = 2;
            }
            if (level == 3) {
                if ((x * 3 + y * 7 + static_cast<int>(t * 60)) % 23 == 0) { ch = '.'; color = 4; }
                if ((x * 11 + y * 5 + static_cast<int>(t * 20)) % 181 == 0) { ch = '*'; color = 3; }
            }
            if (level == 4 && y < Game::H / 2 && (x + static_cast<int>(t * 30)) % 9 == 0) {
                ch = '\''; color = 4;
            }
            if (level == 4 && y > Game::H / 2 && (x % 13 == 0 || x % 17 == 0)) {
                ch = 'A'; color = 4;
            }
            if (level == 1 && (x + static_cast<int>(t * 20)) % 19 == 0 && y > Game::H / 2) {
                ch = '~'; color = 1;
            }

            attron(COLOR_PAIR(color));
            mvaddch(y, x, ch);
            attroff(COLOR_PAIR(color));
        }
    }

    if (level == 3) {
        int cometX = (static_cast<int>(t * 35) % (Game::W + 12)) - 6;
        int cometY = 5 + (static_cast<int>(t * 8) % 6);
        attron(COLOR_PAIR(5) | A_BOLD);
        mvprintw(cometY, cometX, "o===>");
        attroff(COLOR_PAIR(5) | A_BOLD);
    }

    if (level == 10) {
        attron(COLOR_PAIR(2) | A_BOLD);
        mvprintw(4, Game::W - 8, "@@>");
        mvprintw(3, Game::W - 11, "/\\");
        mvprintw(5, Game::W - 11, "\\/");
        attroff(COLOR_PAIR(2) | A_BOLD);
    }
}

static void drawGame(const Game& g) {
    erase();
    box(stdscr, 0, 0);

    auto br = g.brightness;
    (void)br;
    drawBackground(g, static_cast<float>(std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count()) / 1000.0f);

    attron(COLOR_PAIR(1) | A_BOLD);
    mvaddstr(g.apple.y, g.apple.x, "@ ");
    attroff(COLOR_PAIR(1) | A_BOLD);

    for (const auto& o : g.obstacles) {
        attron(COLOR_PAIR(6));
        mvaddstr(o.y, o.x, "◉");
        attroff(COLOR_PAIR(6));
    }

    for (const auto& f : g.fireTiles) {
        attron(COLOR_PAIR(5) | A_BOLD);
        mvaddstr(f.y, f.x, "*");
        attroff(COLOR_PAIR(5) | A_BOLD);
    }

    int bodyColor = g.snakeSkin == 0 ? 2 : (g.snakeSkin == 1 ? 5 : 3);
    bool head = true;
    for (const auto& s : g.snake) {
        attron(COLOR_PAIR(bodyColor) | (head ? A_BOLD : 0));
        mvaddstr(s.y, s.x, head ? "◍" : "●");
        attroff(COLOR_PAIR(bodyColor) | (head ? A_BOLD : 0));
        head = false;
    }

    mvprintw(Game::H, 2, "Poziom %d/%zu: %s | Jablka: %d/%d | Predkosc: x%.1f",
             g.currentLevel, g.levels.size(), g.levels[g.currentLevel - 1].name.c_str(),
             g.apples, Game::APPLES_TO_WIN, 0.12f / g.stepSeconds);
    mvprintw(Game::H + 1, 2, "Sterowanie: strzalki/WASD, spacja=pausa, m=menu, q=wyjdz");

    if (g.gameOver) {
        attron(A_BOLD | COLOR_PAIR(1));
        mvprintw(Game::H / 2, Game::W / 2 - 8, "PRZEGRANA");
        attroff(A_BOLD | COLOR_PAIR(1));
    }
    if (!g.running && !g.gameOver && g.apples >= Game::APPLES_TO_WIN) {
        attron(A_BOLD | COLOR_PAIR(2));
        mvprintw(Game::H / 2, Game::W / 2 - 12, "POZIOM UKONCZONY!");
        attroff(A_BOLD | COLOR_PAIR(2));
    }
    refresh();
}

static void drawMenu(const Game& g, int cursor) {
    erase();
    box(stdscr, 0, 0);
    mvprintw(2, 3, "Snake C++ - bardziej realistyczna wersja terminalowa");
    mvprintw(4, 5, "%c Start od poziomu %d", cursor == 0 ? '>' : ' ', g.selectedLevel);
    mvprintw(5, 5, "%c Ustaw jasnosc: %d%%", cursor == 1 ? '>' : ' ', g.brightness);
    mvprintw(6, 5, "%c Typ weza: %d", cursor == 2 ? '>' : ' ', g.snakeSkin + 1);
    mvprintw(7, 5, "%c Wyjdz", cursor == 3 ? '>' : ' ');

    mvprintw(9, 3, "Odblokowane poziomy: 1-%d", g.unlockedLevel);
    mvprintw(11, 3, "A/D zmien wartosc, W/S porusz, ENTER zatwierdz.");
    mvprintw(13, 3, "Poziomy 1-10: wulkan, las elfow, kosmos, zima, wyspa, fabryka," );
    mvprintw(14, 3, "stadion, western, statek i zamek z bossem-smokiem.");
    refresh();
}

int main() {
    Game g;
    g.loadProgress();

    initscr();
    noecho();
    cbreak();
    keypad(stdscr, TRUE);
    nodelay(stdscr, TRUE);
    curs_set(0);

    initColors();

    bool inMenu = true;
    int menuCursor = 0;
    auto last = std::chrono::steady_clock::now();
    float acc = 0.0f;

    while (true) {
        auto now = std::chrono::steady_clock::now();
        float dt = std::chrono::duration<float>(now - last).count();
        last = now;
        acc += dt;

        int key = getch();

        if (inMenu) {
            drawMenu(g, menuCursor);
            if (key == 'w' || key == KEY_UP) menuCursor = (menuCursor + 3) % 4;
            if (key == 's' || key == KEY_DOWN) menuCursor = (menuCursor + 1) % 4;
            if (key == 'a' || key == KEY_LEFT) {
                if (menuCursor == 0) g.selectedLevel = std::max(1, g.selectedLevel - 1);
                if (menuCursor == 1) g.brightness = std::max(60, g.brightness - 5);
                if (menuCursor == 2) g.snakeSkin = (g.snakeSkin + 2) % 3;
            }
            if (key == 'd' || key == KEY_RIGHT) {
                if (menuCursor == 0) g.selectedLevel = std::min(g.unlockedLevel, g.selectedLevel + 1);
                if (menuCursor == 1) g.brightness = std::min(140, g.brightness + 5);
                if (menuCursor == 2) g.snakeSkin = (g.snakeSkin + 1) % 3;
            }
            if (key == '\n' || key == KEY_ENTER || key == 10) {
                if (menuCursor == 0) {
                    g.startLevel(g.selectedLevel);
                    inMenu = false;
                }
                if (menuCursor == 3) break;
            }
            napms(16);
            continue;
        }

        if (key == 'q') break;
        if (key == 'm') inMenu = true;
        if (key == ' ') g.paused = !g.paused;

        if ((key == 'w' || key == KEY_UP) && g.dir != Dir::Down) g.nextDir = Dir::Up;
        if ((key == 's' || key == KEY_DOWN) && g.dir != Dir::Up) g.nextDir = Dir::Down;
        if ((key == 'a' || key == KEY_LEFT) && g.dir != Dir::Right) g.nextDir = Dir::Left;
        if ((key == 'd' || key == KEY_RIGHT) && g.dir != Dir::Left) g.nextDir = Dir::Right;

        g.updateFire(dt);
        while (acc >= g.stepSeconds) {
            g.advance();
            acc -= g.stepSeconds;
        }

        drawGame(g);
        napms(12);
    }

    endwin();
    return 0;
}
