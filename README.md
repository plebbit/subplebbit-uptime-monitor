### How to use

```
node monitor --subplebbits <path/to/subplebbits> --config <path/to/config>
```

### Subplebbits

A line break separated list of subplebbits.

### Config

A javascript file like:

```
module.exports = {
  alerts: [
    {
      path: './alerts/telegram',
      options: {
        token: 'ABC...'
      }
    }
  ]
}
```
