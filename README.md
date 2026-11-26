# VALOR playbooks

Playbooks for [VALOR](https://github.com/harishmuk/valor-core): folders of plays, skills, guards and evals that run
on the VALOR core. The core is the same for everyone and has no domain built in; a playbook brings the domain.
A playbook can `extend` another, and a customer's workspace is always the last layer.

| Playbook | What it is for |
|---|---|
| [`outbound-email`](outbound-email/README.md) | Horizontal outbound email: sending domain, target list, paced and proven sequences, replies, meetings |

## Layout of a playbook

```
<playbook>/
  playbook.yaml          name, and `extends` for a layer
  plays/<id>/PLAY.md      steps, checks, approvals, pacing, guards, outcome; steps/ checks/ schemas/ evals/
  skills/<id>/SKILL.md    plain, standard skills
  guards/<id>/            GUARD.md + guard.mjs
  lib/                    code shared by the playbook's checks, guards and steps
  examples/workspace/     a runnable workspace with invented data and fixture sources
  test/                   end-to-end tests on the core with fixture agents
```

## Running the tests

Tests load the core from a checkout next to this one (or from `VALOR_CORE`):

```sh
git clone https://github.com/harishmuk/valor-core ../valor-core
(cd ../valor-core && npm install)
npm install
npm test
```

Until the core pull requests merge, check out the core branch with the features playbooks use:
`git -C ../valor-core checkout claude/project-thread-1rqgss`.

## Using a playbook

In a workspace's `valor.yaml`, list the playbook (or your layer on top of it):

```yaml
playbooks: [../valor-playbooks/outbound-email]
```

Then `valor validate` checks that every play, skill, guard and source it names resolves.
