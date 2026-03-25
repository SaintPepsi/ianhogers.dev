---
title: "I Thought I Was Cursed. It Was a Privacy Checkbox."
description: "A tale of broken everything, USB interference, and a 116x latency improvement."
date: 2026-03-25
tags: ["debugging", "macos", "networking", "wifi", "scripts"]
---

Let me paint you a picture of my Wednesday.

AWS study links? Timing out. MFA push for staging deployment? Never arrives. Timesheets? The page spins forever and logs me out. Air conditioning app won't connect to the unit. Speedtest.net won't even load the test. Every single thing that touches the internet is broken, flaky, or just slow enough to make me question my career choices.

The worst part? My wife's laptop, sitting three metres away, is absolutely fine.

So either my Mac mini is haunted, or something very specific is wrong with *my* machine. I asked [Maple](/maple) — my AI assistant — to help me figure it out. What we found was three problems stacked on top of each other like a cursed lasagna.

---

## The Diagnostic Toolkit

Before we get to the fixes, here's every command Maple ran to diagnose the problem. If your Mac is misbehaving, these are the commands that will tell you why.

### Memory: What's eating your RAM?

```bash
# Top 20 processes by memory usage
top -l 1 -s 0 -n 20 -o mem | head -30

# System memory pressure (the number that actually matters)
memory_pressure

# Virtual memory stats — check for swapouts (bad) and compressions (busy)
vm_stat
```

On my machine, this immediately revealed a Claude Code session consuming **7.4GB** — nearly half my 16GB. The system was actively swapping (6,732 swapouts) and compressing (6.7 million compressions). Everything was slow because the OS was constantly shuffling memory to disk.

### Network: Is it actually slow, or does it just feel slow?

```bash
# Basic latency test — the first thing to run
ping -c 5 8.8.8.8

# Check which network interface you're actually using
route -n get default

# WiFi details — band, channel, signal strength, noise
system_profiler SPAirPortDataType | grep -A10 "Current Network"

# Network interface error stats — look for retransmissions
nettop -l 1 -x -t wifi | head -20

# What's using the network right now, by process
lsof -i -n -P | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
```

The WiFi diagnostics were the goldmine. They showed a signal-to-noise ratio of **7 dB** (needs to be above 25), **3.8 million retransmissions**, and an average RTT of **141ms** on what should be a sub-5ms LAN.

### USB: What's plugged in?

```bash
# List all USB devices (the real tree, not the marketing names)
ioreg -p IOUSB -w0 | grep "+-o"

# Thunderbolt/USB-C connected devices
system_profiler SPThunderboltDataType

# External displays
system_profiler SPDisplaysDataType | grep -E "(Display|Connection|Resolution)"
```

This is how we found the USB 3.x hub chain that was generating 2.4GHz interference. `system_profiler` didn't show them — `ioreg` did.

### DNS: Is name resolution the bottleneck?

```bash
# Check your DNS configuration
scutil --dns | head -20

# Check your network config
networksetup -getinfo "Wi-Fi"  # or "Ethernet"
```

---

## Layer 1: "Limit IP Address Tracking" Was Adding 800ms to Everything

First thing Maple did was ping Google's DNS:

```
PING 8.8.8.8 (8.8.8.8): 56 data bytes
64 bytes from 8.8.8.8: icmp_seq=0 ttl=114 time=14.996 ms
Request timeout for icmp_seq 1
64 bytes from 8.8.8.8: icmp_seq=1 ttl=114 time=1775.400 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=114 time=822.396 ms

round-trip min/avg/max/stddev = 14.996/870.931/1775.400/719.501 ms
```

**Average latency: 871ms.** With timeouts. On a home network. That's not internet — that's sending a letter.

The culprit? A setting called **"Limit IP address tracking"** buried in macOS Privacy settings. Sounds harmless. What it actually does is proxy your traffic to hide your IP address from known trackers in Mail and Safari. On a healthy connection you'd never notice it. On a connection that's already drowning in interference? It's the straw that breaks the camel's back — adding proxy overhead to packets that are already being retransmitted millions of times.

I turned it off. Immediately:

```
round-trip min/avg/max/stddev = 23.537/42.097/76.546/18.119 ms
```

**871ms → 42ms.** Just by unticking one privacy checkbox.

If you're on a Mac and your internet feels weirdly slow, check **System Settings → Privacy & Security → Limit IP address tracking**. That one toggle might be your entire problem.

But we weren't done.

---

## Layer 2: My USB Hub Was Jamming My WiFi

42ms is functional, but it's not great for a home network. Maple dug deeper and pulled the WiFi diagnostics:

| Metric | My Mac | What's Normal |
|--------|--------|---------------|
| Signal | -62 dBm | Better than -50 |
| Noise | -69 dBm | Below -85 |
| **SNR** | **7 dB** | **Above 25** |
| Transmit rate | 103 Mbps | 500+ on WiFi 6 |
| Retransmissions | **3.8 million** | Near zero |

A signal-to-noise ratio of 7 dB. That's like trying to have a conversation at a metal concert. My WiFi radio was screaming into the void, retransmitting nearly 4 million packets because most of them were getting lost in the noise.

But here's the thing: the router reported its noise floor at -106 dBm (perfectly clean). The interference was local to my Mac. Something *near my computer* was blasting radio noise on 2.4GHz.

Maple found the culprit by listing USB devices:

```
+-o USB3.1 Hub@08100000
+-o USB2.1 Hub@08300000
  +-o RODE NT-USB@08310000
  +-o USB 2.0 Hub@08330000
  | +-o USB Receiver@08332000
  | +-o Keychron Link@08331000
  +-o Brio 100@08340000
```

A USB 3.x hub chain. USB 3.0 operates at 2.5GHz — right on top of the 2.4GHz WiFi band. It's a [well-documented interference problem](https://www.intel.com/content/www/us/en/products/docs/io/universal-serial-bus/usb3-frequency-interference-paper.html) that Intel published a white paper about back in 2012. The shielding on consumer USB hubs is usually garbage, so the hub radiates noise directly into the WiFi antenna sitting centimetres away.

My wife's laptop doesn't have a USB hub plugged in. Mystery solved.

---

## Layer 3: My Router Wouldn't Let Me Switch to 5GHz

The obvious fix: switch from 2.4GHz to 5GHz. The 5GHz band operates well above USB 3's interference range, and my router (an eero 6+) supports it.

The problem? **Eero doesn't let you choose your WiFi band.** It uses automatic "band steering" — the router decides which band each device gets, and you have no say in the matter. No setting, no toggle, no hidden menu. Eero's philosophy is "trust us, we know best."

Eero was keeping my Mac on 2.4GHz because it couldn't see the interference. From the router's perspective, 2.4GHz looked fine — the noise was local to my desk, invisible to the access point in the other room.

**The manual fix:** Toggle WiFi off and back on. This forces eero to reassign your band, and it usually picks 5GHz on the reconnect. Results:

```
PING 8.8.8.8 (8.8.8.8): 56 data bytes
64 bytes from 8.8.8.8: icmp_seq=0 ttl=114 time=4.870 ms
64 bytes from 8.8.8.8: icmp_seq=1 ttl=114 time=4.837 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=114 time=5.465 ms
64 bytes from 8.8.8.8: icmp_seq=3 ttl=114 time=9.388 ms
64 bytes from 8.8.8.8: icmp_seq=4 ttl=114 time=12.920 ms

round-trip min/avg/max/stddev = 4.837/7.496/12.920/3.197 ms
```

**42ms → 7.5ms.** And from the original: **871ms → 7.5ms. A 116x improvement.**

---

## The Automation: Never Think About This Again

Toggling WiFi manually every time eero drops me back to 2.4GHz isn't a real solution. So we built one.

A macOS launch agent that runs every 60 seconds, checks the current WiFi channel, and if it detects 2.4GHz (channels 1-14), pops up a dialog asking if you want to switch:

```bash
#!/bin/bash
# Monitor WiFi band and prompt to switch from 2.4GHz to 5GHz

INTERFACE="en1"  # Check yours with: networksetup -listallhardwareports
COOLDOWN_FILE="/tmp/wifi-force-5ghz-cooldown"

# Don't nag more than once every 5 minutes
if [ -f "$COOLDOWN_FILE" ]; then
    LAST=$(stat -f %m "$COOLDOWN_FILE" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    if [ $((NOW - LAST)) -lt 300 ]; then exit 0; fi
fi

# Check current channel
CHANNEL=$(system_profiler SPAirPortDataType 2>/dev/null \
    | grep "Channel:" | head -1 | awk '{print $2}')
[ -z "$CHANNEL" ] && exit 0

# 2.4GHz = channels 1-14
if [ "$CHANNEL" -le 14 ] 2>/dev/null; then
    touch "$COOLDOWN_FILE"

    RESPONSE=$(osascript -e 'display dialog "Your Mac is on 2.4GHz WiFi
(channel '"$CHANNEL"'). Switch to 5GHz?" buttons {"Not Now",
"Switch to 5GHz"} default button "Switch to 5GHz" with title
"WiFi Band Alert" with icon caution giving up after 30' 2>/dev/null)

    if echo "$RESPONSE" | grep -q "Switch to 5GHz"; then
        networksetup -setairportpower "$INTERFACE" off
        sleep 3
        networksetup -setairportpower "$INTERFACE" on
    fi
fi
```

Drop this in `~/bin/wifi-force-5ghz.sh`, make it executable, and create a launch agent plist:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.you.wifi-force-5ghz</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/YOU/bin/wifi-force-5ghz.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>60</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Save it to `~/Library/LaunchAgents/`, then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.you.wifi-force-5ghz.plist
```

Now whenever eero silently drops you to 2.4GHz, a dialog pops up asking if you want to fix it. Click the button, WiFi toggles, you're back on 5GHz. It asks first because you might be on a video call and a 3-second WiFi dropout isn't worth it.

---

## Bonus Layer: What Else Is macOS Running That I Never Asked For?

Once you start pulling threads, you can't stop. The WiFi fix got me thinking: what *else* is macOS doing in the background that I never asked for?

I opened Activity Monitor and started looking. Siri daemons running despite Siri being "off." Apple Intelligence processes I never enabled. Telemetry services happily phoning home. A suggestion engine tracking which apps I use. All of them consuming memory and network on a machine that was already struggling with both.

The thing about macOS daemons is that turning them off in System Settings often doesn't actually stop them. The UI toggle flips a preference, but the underlying `launchd` agent keeps running. To actually kill them, you need `launchctl`.

### The Disable Script

This is the real script I wrote and ran. It uses `launchctl disable` (persists across reboots, doesn't require SIP to be off) and `launchctl bootout` (stops the process immediately):

```bash
#!/bin/bash
# disable-macos-bloat.sh — Disable macOS bloatware daemons
# Survives reboots, SIP-safe, reversible
# Reverse with: ~/scripts/enable-macos-bloat.sh

set -euo pipefail
UID_NUM=$(id -u)

disabled=0
stopped=0

disable_agents() {
  local label="$1"; shift
  echo "── ${label} ──"
  for agent in "$@"; do
    short="${agent#com.apple.}"
    if launchctl disable "user/${UID_NUM}/${agent}" 2>/dev/null; then
      ((disabled++))
      printf "  ✓ disabled: %s\n" "$short"
    else
      printf "  · already:  %s\n" "$short"
    fi
    launchctl bootout "gui/${UID_NUM}/${agent}" 2>/dev/null \
        && ((stopped++)) || true
  done
  echo ""
}

echo "🧹 Disabling macOS bloatware..."
echo ""

disable_agents "Siri & Assistants" \
  com.apple.assistantd \
  com.apple.assistant_service \
  com.apple.assistant_cdmd \
  com.apple.Siri.agent \
  com.apple.siri.context.service \
  com.apple.siriactionsd \
  com.apple.siriinferenced \
  com.apple.siriknowledged \
  com.apple.suggestd \
  com.apple.proactived \
  com.apple.knowledge-agent \
  com.apple.parsecd \
  com.apple.corespeechd

disable_agents "Apple Intelligence / ML" \
  com.apple.generativeexperiencesd \
  com.apple.intelligenceplatformd \
  com.apple.intelligencecontextd \
  com.apple.intelligentroutingd \
  com.apple.privatecloudcomputed \
  com.apple.mlhostd \
  com.apple.translationd \
  com.apple.voicebankingd

disable_agents "Telemetry & Analytics" \
  com.apple.geoanalyticsd \
  com.apple.feedbackd \
  com.apple.inputanalyticsd \
  com.apple.triald

disable_agents "Nag Daemons & Unused" \
  com.apple.tipsd \
  com.apple.followupd \
  com.apple.betaenrollmentagent \
  com.apple.studentd \
  com.apple.sociallayerd \
  com.apple.ScreenTimeAgent

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Disabled: ${disabled}  Stopped: ${stopped}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Verification:"
launchctl print-disabled "user/${UID_NUM}" 2>/dev/null \
    | grep "disabled" || echo "  (none found)"
echo ""
echo "Changes persist across reboots."
echo "Reverse with: ~/scripts/enable-macos-bloat.sh"
```

That's 29 daemons across four categories. Siri's entire constellation of agents (13 of them, for a feature I don't use). Apple Intelligence and ML services (8 processes, including `privatecloudcomputed` which sends data to Apple's servers for AI processing). Telemetry (4 analytics daemons). And nag daemons like `tipsd` (the "Did you know?" popups) and `betaenrollmentagent`.

### The key details

**`launchctl disable`** vs **`launchctl unload`**: `unload` only lasts until the next reboot. `disable` persists. It writes to `/var/db/com.apple.xpc.launchd/disabled.plist` and the agent won't start again until you explicitly re-enable it.

**`launchctl bootout`** kills the running process immediately. Without it, the agent stays running until your next logout even though it won't start again after that.

**SIP stays on.** This doesn't touch system files. It just tells `launchd` "don't start this agent for my user account." Completely reversible.

### The Undo Script

Everything is reversible. The enable script mirrors the disable script exactly:

```bash
#!/bin/bash
# enable-macos-bloat.sh — Re-enable macOS daemons
# Agents will start on next login

set -euo pipefail
UID_NUM=$(id -u)

enabled=0

enable_agents() {
  local label="$1"; shift
  echo "── ${label} ──"
  for agent in "$@"; do
    short="${agent#com.apple.}"
    if launchctl enable "user/${UID_NUM}/${agent}" 2>/dev/null; then
      ((enabled++))
      printf "  ✓ enabled:  %s\n" "$short"
    else
      printf "  · already:  %s\n" "$short"
    fi
  done
  echo ""
}

echo "♻️  Re-enabling macOS daemons..."
echo ""

# Same agent lists as disable script...
enable_agents "Siri & Assistants" \
  com.apple.assistantd \
  com.apple.assistant_service \
  # ... (same full list)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Re-enabled: ${enabled}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Agents will start on next login, or reboot to activate all."
```

If something breaks — a feature you actually needed stops working — run the enable script and reboot. No damage done.

### What this actually freed up

After running the disable script and rebooting, Activity Monitor told a different story. No more `assistantd` quietly consuming 80MB. No more `suggestd` indexing my habits. No more `intelligenceplatformd` waiting to send data to Apple's cloud. On a 16GB machine where a single Claude Code session can eat 7GB, every megabyte of headroom matters.

The WiFi problem taught me something: the default state of a Mac isn't "working for you." It's "working for Apple, and also incidentally for you, unless those goals conflict." Every one of these services is individually reasonable. Together, on a constrained machine, they're death by a thousand cuts.

---

## The Summary

Three problems. Three fixes. One increasingly suspicious feeling that technology is gaslighting me.

| What | Before | After |
|------|--------|-------|
| "Limit IP address tracking" | 871ms avg, timeouts | 42ms avg |
| 2.4GHz → 5GHz switch | 42ms avg | 7.5ms avg |
| **Combined** | **871ms, unusable** | **7.5ms, perfect** |

**If your Mac feels cursed, check these three things:**

1. **System Settings → Privacy & Security → "Limit IP address tracking"** — turn it off if your network is already trusted
2. **Check your USB hub situation** — USB 3.x devices generate 2.4GHz interference. If your hub is right next to your Mac, that's your noise source
3. **Check your WiFi band** — Option-click the WiFi icon, look at the channel number. Channels 1-14 = 2.4GHz. Channels 36+ = 5GHz. If you're stuck on 2.4GHz with a USB hub nearby, toggle WiFi off and on

Your computer probably isn't cursed. It's just that three different "smart" systems — Apple's IP tracking protection, your router's band steering, and USB 3's frequency allocation — are conspiring to make your life worse.

And they were getting away with it until today.
