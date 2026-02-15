# Elf of Evershade (C# / Windows)

Dwuwymiarowa gra platformowa inspirowana stylem Mario:
- bohater: elf Aelion (długie blond włosy),
- dwie bronie: **łuk** (`1`) oraz **ogień dłoni** (`2`),
- 20 poziomów z przewijanym ekranem,
- przeciwnicy: orki, gobliny, zombie, starzy czarodzieje,
- zbieranie bonusów: szybszy atak i leczenie,
- zdrowie startowe: 100 HP,
- fabularny prolog i końcowy „film” (sekwencja scen).

## Uruchomienie na Windows
1. Zainstaluj .NET SDK 8.0.
2. W folderze projektu uruchom:
   ```bash
   dotnet run --project ElfOfEvershade.csproj
   ```

## Sterowanie
- `A` / `D` lub strzałki: ruch
- `Spacja` / `W` / `↑`: skok
- `J` / `Ctrl`: atak
- `1`: łuk
- `2`: ogień z dłoni
- `R`: restart po przegranej / po zakończeniu gry

Gra generuje własny prosty motyw muzyczny WAV przy pierwszym uruchomieniu i odtwarza go w pętli.
