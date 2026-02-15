using System.Drawing.Drawing2D;
using System.Media;

namespace ElfOfEvershade;

public class GameForm : Form
{
    private readonly Timer _timer = new() { Interval = 16 };
    private readonly HashSet<Keys> _keys = [];

    private readonly List<PlatformTile> _platforms = [];
    private readonly List<Enemy> _enemies = [];
    private readonly List<Projectile> _projectiles = [];
    private readonly List<Pickup> _pickups = [];

    private readonly Player _player = new();
    private readonly Random _random = new();

    private int _level = 1;
    private const int MaxLevel = 20;
    private float _cameraX;
    private float _worldWidth;
    private int _fireCooldown;
    private int _damageCooldown;

    private bool _showIntro = true;
    private bool _gameWon;
    private int _endingFrame;
    private readonly List<string> _endingScenes =
    [
        "Rozdział I: Elf Aelion podnosi Łuk Świtu nad popiołami Cytadeli Mroku.",
        "Rozdział II: Ostatni ork klęka, a las odzyskuje dawny oddech.",
        "Rozdział III: Gobliny uciekają w mgłę, a mosty znów łączą osady.",
        "Rozdział IV: Stary czarodziej oddaje serce lasu i przeprasza za klątwę.",
        "Rozdział V: Aelion wraca do domu – legenda zostaje zapisana jak księga."
    ];

    private readonly string _story =
        "W pradawnym lesie Evershade młody elf Aelion, o długich blond włosach, " +
        "wyrusza po Księgę Iskier. Każdy rozdział to nowa próba: orki, gobliny, zombie i starzy " +
        "czarodzieje strzegący mostów i drzewnych ruin. Z łukiem i ogniem dłoni elf oczyszcza " +
        "dwadzieścia krain, by przywrócić światło i zakończyć klątwę Wiecznego Cienia.";

    private SoundPlayer? _music;

    public GameForm()
    {
        Text = "Elf of Evershade - Platformowa opowieść";
        ClientSize = new Size(1280, 720);
        DoubleBuffered = true;
        BackColor = Color.Black;
        KeyPreview = true;

        _timer.Tick += (_, _) => UpdateGame();
        _timer.Start();

        KeyDown += OnKeyDown;
        KeyUp += (_, e) => _keys.Remove(e.KeyCode);

        BuildLevel(_level);
        StartMusic();
    }

    private void StartMusic()
    {
        try
        {
            var path = Path.Combine(Path.GetTempPath(), "evershade_theme.wav");
            if (!File.Exists(path))
            {
                CreateSimpleWav(path);
            }
            _music = new SoundPlayer(path);
            _music.PlayLooping();
        }
        catch
        {
            // Gra działa także bez dźwięku.
        }
    }

    private static void CreateSimpleWav(string path)
    {
        const int sampleRate = 22050;
        const short bits = 16;
        const short channels = 1;
        var melody = new[] { 329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63, 261.63 };
        var durationPerNote = 0.24;
        var totalSamples = (int)(sampleRate * durationPerNote * melody.Length);
        using var stream = new FileStream(path, FileMode.Create, FileAccess.Write);
        using var writer = new BinaryWriter(stream);

        writer.Write("RIFF"u8.ToArray());
        writer.Write(36 + totalSamples * 2);
        writer.Write("WAVE"u8.ToArray());
        writer.Write("fmt "u8.ToArray());
        writer.Write(16);
        writer.Write((short)1);
        writer.Write(channels);
        writer.Write(sampleRate);
        writer.Write(sampleRate * channels * bits / 8);
        writer.Write((short)(channels * bits / 8));
        writer.Write(bits);
        writer.Write("data"u8.ToArray());
        writer.Write(totalSamples * 2);

        for (var i = 0; i < melody.Length; i++)
        {
            var freq = melody[i];
            var noteSamples = (int)(sampleRate * durationPerNote);
            for (var s = 0; s < noteSamples; s++)
            {
                var t = s / (double)sampleRate;
                var sample = (short)(Math.Sin(2 * Math.PI * freq * t) * 4500);
                writer.Write(sample);
            }
        }
    }

    private void BuildLevel(int level)
    {
        _platforms.Clear();
        _enemies.Clear();
        _projectiles.Clear();
        _pickups.Clear();

        _player.Position = new PointF(80, 500);
        _player.Velocity = PointF.Empty;
        _player.OnGround = false;
        _cameraX = 0;
        _fireCooldown = 0;
        _damageCooldown = 0;

        _worldWidth = 3200 + level * 180;
        _platforms.Add(new PlatformTile(0, 660, _worldWidth, 80, PlatformKind.Ground));

        for (var i = 0; i < 28 + level; i++)
        {
            var x = 260 + i * 120;
            var y = 620 - _random.Next(0, 5) * 70;
            var kind = (i % 3 == 0) ? PlatformKind.Bridge : PlatformKind.TreeBranch;
            _platforms.Add(new PlatformTile(x, y, 110, 24, kind));
        }

        SpawnEnemies(EnemyType.Ork, 3 + level / 2);
        SpawnEnemies(EnemyType.Goblin, 2 + level / 3);
        SpawnEnemies(EnemyType.Zombie, 2 + level / 4);
        SpawnEnemies(EnemyType.OldWizard, 1 + level / 5);

        for (var i = 0; i < 5; i++)
        {
            var x = 350 + _random.Next(0, (int)_worldWidth - 500);
            var y = 420 + _random.Next(-180, 120);
            var type = i % 2 == 0 ? PickupType.AttackSpeed : PickupType.Health;
            _pickups.Add(new Pickup(new RectangleF(x, y, 24, 24), type));
        }
    }

    private void SpawnEnemies(EnemyType type, int count)
    {
        for (var i = 0; i < count; i++)
        {
            var x = 500 + _random.Next(0, (int)_worldWidth - 800);
            var y = 610;
            var hp = type switch
            {
                EnemyType.Ork => 35,
                EnemyType.Goblin => 22,
                EnemyType.Zombie => 30,
                _ => 45
            };
            _enemies.Add(new Enemy(type, hp, new RectangleF(x, y, 32, 50)));
        }
    }

    private void OnKeyDown(object? sender, KeyEventArgs e)
    {
        _keys.Add(e.KeyCode);

        if (_showIntro && e.KeyCode == Keys.Enter)
        {
            _showIntro = false;
        }

        if ((_gameWon || _player.Health <= 0) && e.KeyCode == Keys.R)
        {
            _gameWon = false;
            _showIntro = true;
            _endingFrame = 0;
            _level = 1;
            _player.Health = 100;
            _player.AttackCooldown = 18;
            BuildLevel(_level);
        }

        if (e.KeyCode == Keys.D1) _player.Weapon = Weapon.Bow;
        if (e.KeyCode == Keys.D2) _player.Weapon = Weapon.FireHands;
    }

    private void UpdateGame()
    {
        if (_showIntro)
        {
            Invalidate();
            return;
        }

        if (_gameWon)
        {
            _endingFrame = (_endingFrame + 1) % (_endingScenes.Count * 180);
            Invalidate();
            return;
        }

        if (_player.Health <= 0)
        {
            Invalidate();
            return;
        }

        ApplyInput();
        ApplyPhysics();
        UpdateProjectiles();
        UpdateEnemies();
        HandlePickups();

        if (_enemies.Count == 0 && _player.Position.X > _worldWidth - 240)
        {
            _level++;
            if (_level > MaxLevel)
            {
                _gameWon = true;
            }
            else
            {
                BuildLevel(_level);
            }
        }

        if (_fireCooldown > 0) _fireCooldown--;
        if (_damageCooldown > 0) _damageCooldown--;

        _cameraX = Math.Clamp(_player.Position.X - ClientSize.Width / 2f, 0, _worldWidth - ClientSize.Width);

        Invalidate();
    }

    private void ApplyInput()
    {
        var move = 0f;
        if (_keys.Contains(Keys.A) || _keys.Contains(Keys.Left)) move -= 1;
        if (_keys.Contains(Keys.D) || _keys.Contains(Keys.Right)) move += 1;

        _player.Velocity = new PointF(move * _player.MoveSpeed, _player.Velocity.Y);

        if ((_keys.Contains(Keys.W) || _keys.Contains(Keys.Space) || _keys.Contains(Keys.Up)) && _player.OnGround)
        {
            _player.Velocity = new PointF(_player.Velocity.X, -13.5f);
            _player.OnGround = false;
        }

        if ((_keys.Contains(Keys.J) || _keys.Contains(Keys.ControlKey)) && _fireCooldown == 0)
        {
            FireProjectile();
            _fireCooldown = _player.AttackCooldown;
        }
    }

    private void FireProjectile()
    {
        var speed = _player.Weapon == Weapon.Bow ? 14f : 10f;
        var damage = _player.Weapon == Weapon.Bow ? 16 : 24;
        var color = _player.Weapon == Weapon.Bow ? Color.Gold : Color.OrangeRed;
        var rect = new RectangleF(_player.Position.X + 18, _player.Position.Y + 20, 14, 8);
        _projectiles.Add(new Projectile(rect, new PointF(speed, 0), damage, color));
    }

    private void ApplyPhysics()
    {
        _player.Velocity = new PointF(_player.Velocity.X, _player.Velocity.Y + 0.7f);
        var next = _player.Bounds;
        next.X += _player.Velocity.X;
        next.Y += _player.Velocity.Y;
        _player.OnGround = false;

        foreach (var tile in _platforms)
        {
            if (!next.IntersectsWith(tile.Bounds)) continue;
            var current = _player.Bounds;

            if (current.Bottom <= tile.Bounds.Top && _player.Velocity.Y >= 0)
            {
                next.Y = tile.Bounds.Top - next.Height;
                _player.Velocity = new PointF(_player.Velocity.X, 0);
                _player.OnGround = true;
            }
            else if (current.Top >= tile.Bounds.Bottom && _player.Velocity.Y < 0)
            {
                next.Y = tile.Bounds.Bottom;
                _player.Velocity = new PointF(_player.Velocity.X, 0.5f);
            }
        }

        next.X = Math.Clamp(next.X, 0, _worldWidth - next.Width);
        if (next.Y > 760)
        {
            _player.Health -= 12;
            next.Location = new PointF(Math.Max(30, _player.Position.X - 100), 500);
            _player.Velocity = PointF.Empty;
        }

        _player.Position = new PointF(next.X, next.Y);
    }

    private void UpdateProjectiles()
    {
        for (var i = _projectiles.Count - 1; i >= 0; i--)
        {
            var p = _projectiles[i];
            p.Bounds = new RectangleF(p.Bounds.X + p.Velocity.X, p.Bounds.Y + p.Velocity.Y, p.Bounds.Width, p.Bounds.Height);

            var removed = false;
            for (var e = _enemies.Count - 1; e >= 0; e--)
            {
                if (!p.Bounds.IntersectsWith(_enemies[e].Bounds)) continue;
                _enemies[e].Health -= p.Damage;
                if (_enemies[e].Health <= 0)
                {
                    _enemies.RemoveAt(e);
                }
                _projectiles.RemoveAt(i);
                removed = true;
                break;
            }

            if (removed) continue;

            if (p.Bounds.X > _worldWidth || p.Bounds.X < 0)
            {
                _projectiles.RemoveAt(i);
            }
        }
    }

    private void UpdateEnemies()
    {
        foreach (var enemy in _enemies)
        {
            var dir = Math.Sign(_player.Position.X - enemy.Bounds.X);
            enemy.Bounds = new RectangleF(enemy.Bounds.X + dir * enemy.Speed, enemy.Bounds.Y, enemy.Bounds.Width, enemy.Bounds.Height);

            if (enemy.Bounds.IntersectsWith(_player.Bounds) && _damageCooldown == 0)
            {
                _player.Health -= enemy.ContactDamage;
                _damageCooldown = 25;
            }
        }
    }

    private void HandlePickups()
    {
        for (var i = _pickups.Count - 1; i >= 0; i--)
        {
            if (!_pickups[i].Bounds.IntersectsWith(_player.Bounds)) continue;

            if (_pickups[i].Type == PickupType.Health)
            {
                _player.Health = Math.Min(100, _player.Health + 20);
            }
            else
            {
                _player.AttackCooldown = Math.Max(6, _player.AttackCooldown - 2);
            }
            _pickups.RemoveAt(i);
        }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Color.FromArgb(17, 36, 28));

        if (_showIntro)
        {
            DrawIntro(g);
            return;
        }

        if (_gameWon)
        {
            DrawEndingFilm(g);
            return;
        }

        DrawBackground(g);
        g.TranslateTransform(-_cameraX, 0);

        foreach (var tile in _platforms)
        {
            var color = tile.Kind == PlatformKind.TreeBranch ? Color.SaddleBrown : Color.Peru;
            using var b = new SolidBrush(color);
            g.FillRectangle(b, tile.Bounds);
        }

        DrawPlayer(g);

        foreach (var enemy in _enemies)
        {
            using var b = new SolidBrush(enemy.Type switch
            {
                EnemyType.Ork => Color.DarkOliveGreen,
                EnemyType.Goblin => Color.LimeGreen,
                EnemyType.Zombie => Color.SlateGray,
                _ => Color.MediumPurple
            });
            g.FillEllipse(b, enemy.Bounds);
        }

        foreach (var p in _projectiles)
        {
            using var b = new SolidBrush(p.Color);
            g.FillEllipse(b, p.Bounds);
        }

        foreach (var p in _pickups)
        {
            using var b = new SolidBrush(p.Type == PickupType.Health ? Color.HotPink : Color.LightSkyBlue);
            g.FillRectangle(b, p.Bounds);
        }

        g.ResetTransform();
        DrawHud(g);
    }

    private void DrawIntro(Graphics g)
    {
        using var titleBrush = new SolidBrush(Color.Gold);
        using var textBrush = new SolidBrush(Color.WhiteSmoke);
        using var titleFont = new Font("Segoe UI", 34, FontStyle.Bold);
        using var textFont = new Font("Segoe UI", 13, FontStyle.Regular);

        g.DrawString("ELF OF EVERSHADE", titleFont, titleBrush, 320, 80);
        g.DrawString(_story, textFont, textBrush, new RectangleF(140, 180, 1000, 220));
        g.DrawString("Sterowanie: A/D ruch, Spacja skok, J strzał, 1 łuk, 2 ogień dłoni", textFont, textBrush, 170, 480);
        g.DrawString("Naciśnij Enter, aby zacząć 20-rozdziałową przygodę.", textFont, Brushes.LightGreen, 330, 540);
    }

    private void DrawEndingFilm(Graphics g)
    {
        var scene = _endingScenes[Math.Min(_endingScenes.Count - 1, _endingFrame / 180)];
        using var titleFont = new Font("Georgia", 28, FontStyle.Bold);
        using var textFont = new Font("Georgia", 17, FontStyle.Italic);
        g.FillRectangle(Brushes.Black, ClientRectangle);
        g.DrawString("Film końcowy: Kroniki Evershade", titleFont, Brushes.Gold, 240, 90);
        g.DrawString(scene, textFont, Brushes.WhiteSmoke, new RectangleF(170, 250, 920, 220));
        g.DrawString("Gratulacje! Ukończono wszystkie 20 poziomów. Naciśnij R, aby zagrać ponownie.",
            new Font("Segoe UI", 12), Brushes.LightGreen, 190, 600);
    }

    private void DrawBackground(Graphics g)
    {
        using var moon = new SolidBrush(Color.FromArgb(240, 240, 200));
        g.FillEllipse(moon, 980, 60, 90, 90);

        for (var i = 0; i < 20; i++)
        {
            var x = (i * 160) - (_cameraX * 0.2f % 160);
            g.FillRectangle(Brushes.DarkSeaGreen, x, 300, 60, 380);
        }
    }

    private void DrawPlayer(Graphics g)
    {
        var bounds = _player.Bounds;
        using var skin = new SolidBrush(Color.PeachPuff);
        using var tunic = new SolidBrush(Color.ForestGreen);
        using var hair = new SolidBrush(Color.Goldenrod);

        g.FillRectangle(tunic, bounds.X, bounds.Y + 16, bounds.Width, bounds.Height - 16);
        g.FillEllipse(skin, bounds.X + 6, bounds.Y, 20, 20);
        g.FillEllipse(hair, bounds.X + 2, bounds.Y - 2, 28, 12);

        if (_player.Weapon == Weapon.Bow)
        {
            using var pen = new Pen(Color.SandyBrown, 2);
            g.DrawArc(pen, bounds.X + 24, bounds.Y + 18, 14, 20, -70, 140);
        }
        else
        {
            using var b = new SolidBrush(Color.OrangeRed);
            g.FillEllipse(b, bounds.X + 26, bounds.Y + 26, 8, 8);
        }
    }

    private void DrawHud(Graphics g)
    {
        g.FillRectangle(Brushes.Black, 14, 14, 300, 84);
        g.DrawRectangle(Pens.White, 14, 14, 300, 84);
        g.DrawString($"Poziom: {_level}/20", new Font("Segoe UI", 11, FontStyle.Bold), Brushes.White, 26, 20);
        g.DrawString($"Zdrowie: {_player.Health}/100", new Font("Segoe UI", 11, FontStyle.Bold), Brushes.White, 26, 46);
        g.DrawString($"Broń: {(_player.Weapon == Weapon.Bow ? "Łuk" : "Ogień dłoni")}", new Font("Segoe UI", 10), Brushes.White, 26, 70);

        if (_player.Health <= 0)
        {
            g.DrawString("Elf poległ... Naciśnij R, by rozpocząć od nowa.", new Font("Segoe UI", 24, FontStyle.Bold), Brushes.OrangeRed, 250, 280);
        }
    }
}

public enum Weapon { Bow, FireHands }
public enum EnemyType { Ork, Goblin, Zombie, OldWizard }
public enum PlatformKind { Ground, TreeBranch, Bridge }
public enum PickupType { AttackSpeed, Health }

public sealed class Player
{
    public PointF Position { get; set; } = new(80, 500);
    public PointF Velocity { get; set; }
    public int Health { get; set; } = 100;
    public float MoveSpeed { get; } = 6.5f;
    public bool OnGround { get; set; }
    public Weapon Weapon { get; set; }
    public int AttackCooldown { get; set; } = 18;

    public RectangleF Bounds => new(Position.X, Position.Y, 32, 52);
}

public sealed class PlatformTile(float x, float y, float w, float h, PlatformKind kind)
{
    public RectangleF Bounds { get; } = new(x, y, w, h);
    public PlatformKind Kind { get; } = kind;
}

public sealed class Enemy(EnemyType type, int health, RectangleF bounds)
{
    public EnemyType Type { get; } = type;
    public int Health { get; set; } = health;
    public RectangleF Bounds { get; set; } = bounds;
    public float Speed => Type == EnemyType.Goblin ? 2.1f : 1.4f;
    public int ContactDamage => Type == EnemyType.OldWizard ? 16 : 10;
}

public sealed class Projectile(RectangleF bounds, PointF velocity, int damage, Color color)
{
    public RectangleF Bounds { get; set; } = bounds;
    public PointF Velocity { get; } = velocity;
    public int Damage { get; } = damage;
    public Color Color { get; } = color;
}

public sealed class Pickup(RectangleF bounds, PickupType type)
{
    public RectangleF Bounds { get; } = bounds;
    public PickupType Type { get; } = type;
}
