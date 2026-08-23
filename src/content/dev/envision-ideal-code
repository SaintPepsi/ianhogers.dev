---
title: "How to envision ideal code instead of fixing afterwards"
description: "A skill that writes a skill for your agent to write code exactly how you want"
date: 2026-08-23
tags: ["claude code", "skill", "svelte", "ui", "llm", "hand-written"]
---

AI sucks at writing code, especially desired standards. and that's probably because everyone just has it wing it and then fix things afterwards.

"Code the thing" > "Fix this part" > "Fix that part" > "/simplify" > "fix this here part" > "Fuck ok whatever it's good enough"

I hate that, and it's because that's what developers are like when they are under pressure. it's the same pattern, they write the code as quick as possible, then spend 7 iterations fixing it..

There's never going to be time to refactor code that's been written poorly, even if something is meant to take 8 hours, and you finish it in 2 hours, unless you lie or not tell no-one it's done 6 hours faster, you will never get a chance it fix/improve it, your improvement goes into the backlog black hole!

I'm a tireless idealist, it's a very unfortunate trait to live by, it's a double edged sword that has the sharpest edge aimed towards yourself. this also means that as a developer i've always strived to write the best code I could with the knowledge I had. and at this point that means that If I touch front-end code, it has to be of a certain quality or else I will take self-inflicted mental health _dot_ 

How AI x Dev conversations often go:
Human: "Build a toast notification component/system"
AI: "No problem!"
AI: "Blaberoodering..."
AI: "Churned for 15 minutes"
Human: "Wow this is absolute dog shit code but it's done now, time to move on!"

And this problem gets worse the more complex the codebase is, unit tests, end to end tests, design systems, custom ui components, compound components, you name it, every addition makes it more likely for an ai to just fail.

And you don't want to spend 15 minutes writing a prompt every time you want to create/update a ui components, or any part of your system. because you might as well code it yourself then.

I realised the problem is the ai doesn't know what to _Envision_. and converting your internal "Tacit Model" (internal intuitive know how) into a real tangable SKILL the agent can rely upon.

My standards are something like this:
very low quality code: Scattered markup, random classes, incoherent implementations
passable quality code: some shared components, scattered markup, looking at it you go "They made it work"
Good code: Coherent markup, reussed components, compound components, easy to read, glancable, no random classes or markup, looking at it you go "Wow I can see the ui in my brain without even having to render the page"

I have my ai get to the "Good code" by having it "Envision" the good code as if there were not constraints. not looking at existing code, just an idealist version of what you wantn to make:
This gist contiains 2 things.
1. A skill to help you write a model yourself that you can use as skill.
2. Example Svelte ui component envision to see what it looks like. (and the envision.md is human readable, minimal noise, or at least it should be)
[envision/SKILL.md](https://gist.github.com/SaintPepsi/bbbecfab6e5ce9e5b8244c77edac0b40)

Use the main skill to help construct an envisioning model for your ai to use so it writes code like this:
```jsx
<Toast.Wrapper>
  <Toast.Icon variant="success" />
  <Toast.Body>
    <Text.Heading>Saved</Text.Heading>
    <Text.Body>Your changes were saved.</Text.Body>
  </Toast.Body>
  <Toast.CloseButton />
</Toast.Wrapper>
```

Instead of
```html
<div class='wrapper somerandom otherclass that is required for overriding'>
... 500 other raw markup elements, i'm not even going to type it or i'll take `dot`
</div>
```

Use it to help ai write code that you envision rather than what it's trained to write by default given the context is has
