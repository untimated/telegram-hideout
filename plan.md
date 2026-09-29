# Brief

this is an effort to make my telegram group "Gossip Boy" mini app
more useful, interesting and had something going on. It's been quite silent lately
so i think, making extended tangible world even small.

# Goal

The Name "Hideout" is less antagonistic and more of relaxed one.
It's a series of small maps stiched together, built like an first person rpg,
but with mechanics similar to the sims. there will be plenty of mechanics that will be integrated with realtime web data.

# Core Features

## Roaming
Simple First person roaming around, you'll be able to see other players using
client-server websocket. 

## Interaction
Some objects and all players are interactable (point click) 
and will show HTML UI.
- Buying drinks and food through the bartender (money will be refilled everyday like manga-up coin)
- Jukebox will show  up two selections of music (default silent) send to server and send play-command to other players as well (same with pause - by default repeat).


## NPCS
Will be static, have schedule for each.
No path finding needed, just let them appear on their designated place... 
or ocasionally give them static round patrol movement

- Plain Joe 
  Time     : 11AM-3PM
  Position : at Table 2
  Activity : Lunch (just sitting for now)
- Nicholas came at 
  Time     : 5AM-9PM
  Position : By Jukebox
  Activity : dancing
- Yan 
  Time     : 9AM-1PM
  Position : By the window
  Activity : staring at the pool 
- Samantha, Stanley the organist and Harvey the percussionist 
  Time     : 9AM-1PM
  Position : Stage
  Activity : staring at the pool 
- Wolfred the bartender
  Time     : 9am to 12pm
  Position : Bar
  Activity : initiate buy drink UI (cannot buy if he's present)
- Pierre the Cook
  Time     : 8am to 8pm
  Position : Kitchen Counter
  Activity : initiate food (cannot buy it he's not present)
- ...


# Economy
Player is given 100 coin per day to spend, value will carry over if saved 
persist it in local storage if possible, but if mini app (telegram webvie) can't, just limit per session

## Trading
we can provide transfer coin as well for our poor friends

## Goods
I'll provide the icon later, use default first
Bar Menu (interact with Wolfred) :
- Pint of Beer - 20 coin
- Highball     - 30 coin
- Mojito       - 40 coin
- Gossip Sherry(wine) - 50 coin

Food Menu (buffer counter interaction) :
- Gossip's original Breakfast   - 20 coin
- Uncle's Fried Rice            - 30 Coin
- Pierre's Smash Burger         - 15 coin

Complementary Menu (Fountain area) :
- Chocolate Fondue  - 10 coin
- Orange Juice      - 5 coin
- Apple Juice      - 5 coin

Jukebox : 
- Determined Vaporwave By Catch22Music  - 10 coin
- Exploring Vaporwave By Catch22Music   - 10 coin:w
 

# Mood / State
Consuming something, or doing something induces effects scale from -1 to 1
- Drunk
- Rested
- Hunger
