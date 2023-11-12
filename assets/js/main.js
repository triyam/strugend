/*==================== Vinnala Toast ====================*/
(function () {
  "use strict";

  // VanillaToast class
  var VanillaToast = (function () {
    function VanillaToast() {
      this.queue = new TaskQueue();
      this.cancellationTokens = [];
      this.element = null;
    }

    var constants = {
      default: {
        className: 'default',
        fadeDuration: 400,
        fadeInterval: 16,
        duration: 2000,
        closeButton: false,
        immediately: false
      },
      success: {
        className: 'success'
      },
      info: {
        className: 'info'
      },
      warning: {
        className: 'warning'
      },
      error: {
        className: 'error',
        duration: 3000,
        closeButton: true
      }
    };

    // create elements.
    VanillaToast.prototype.initElement = function (selector) {
      var container = document.createElement('div');
      var toastBox = document.createElement('div');
      var text = document.createElement('div');
      var closeButton = document.createElement('span');

      container.setAttribute("id", "vanilla-toast-container");

      toastBox.setAttribute("id", "vanilla-toast");

      text.setAttribute("id", "vanilla-toast-text");

      closeButton.setAttribute("id", "vanilla-toast-close-button");
      closeButton.innerHTML = '&#10006;';

      toastBox.appendChild(text);
      toastBox.appendChild(closeButton);
      container.appendChild(toastBox);

      if (selector) {
        document.getElementById(seletor).appendChild(containter);
      } else {
        document.body.appendChild(container);
      }

      this.element = {
        container: container,
        toastBox: toastBox,
        text: text,
        closeButton: closeButton
      };

      _setStyle(this, constants.default);
    };

    // cancel current showing toast.
    VanillaToast.prototype.cancel = function () {
      if (this.cancellationTokens.length) this.cancellationTokens[0].cancel();
    };

    // cancel all enqueued toasts.
    VanillaToast.prototype.cancelAll = function () {
      var length = this.cancellationTokens.length;
      for (var i = 0; i < length; ++i) {
        (function (token) {
          token.cancel();
        })(this.cancellationTokens[length - i - 1]);
      }
    };

    // show toast
    VanillaToast.prototype.show = function (text, option, callback) {
      var self = this;
      if (!self.element) self.initElement();
      if (!option) option = {};
      // if immediately show option is on, cancel all previous toasts.
      if (option.immediately) self.cancelAll();

      var cancellationToken = new CancellationToken();
      // enqueue
      self.queue.enqueue(function (next) {
        // time setting
        var fadeDuration = option.fadeDuration || constants.default.fadeDuration;
        var fadeInterval = option.fadeInterval || constants.default.fadeInterval;
        var fadeStep = Math.min(fadeInterval / fadeDuration, 1);
        var duration = option.duration || constants.default.duration;

        // close button setting
        self.element.closeButton.style.display =
          option.closeButton ? 'inline' : 'none';

        // set text
        self.element.text.innerHTML = text;

        // set visible
        var s = self.element.toastBox.style;
        s.opacity = 0;
        s.display = 'inline-block';

        // set styles
        _setStyle(self, option);

        // timeoutId
        var timeoutId = null;

        // duration timeout callback.
        var timeoutCallback = function () {
          timeoutId = null;
          // release click clickHandler
          self.element.toastBox.removeEventListener('click', cancelHandler);
          _hide(self, option, cancellationToken, function () {
            if (callback) callback();
            self.cancellationTokens.shift().dispose();
            next();
          });
        };

        // click for close handler
        var cancelHandler = function () {
          if (!timeoutId) return;
          clearTimeout(timeoutId);
          timeoutCallback();
        };

        // start fade in.
        _fade(s, fadeStep, fadeInterval, cancellationToken, function () {
          // show while duration time and hide.
          self.element.toastBox.addEventListener('click', cancelHandler);
          if (cancellationToken.isCancellationRequested) {
            timeoutCallback();
          } else {
            timeoutId = setTimeout(timeoutCallback, duration);
            cancellationToken.register(function () {
              cancelHandler();
            });
          }
        });
      });

      self.cancellationTokens.push(cancellationToken);

      return self;
    };

    // create preset methods
    for (var item in constants) {
      (function (preset) {
        VanillaToast.prototype[preset] = function (text, option, callback) {
          if (!option) option = {};

          // copy preset options
          for (var propertyName in constants[preset]) {
            if (option[propertyName] === undefined)
              option[propertyName] = constants[preset][propertyName];
          }

          return this.show(text, option, callback);
        };
      })(item);
    }

    // private methods.

    // set style
    function _setStyle(self, option) {
      self.element.toastBox.className = option.className || constants.default.className;
    };

    // hide toast
    function _hide(self, option, cancellationToken, callback) {
      if (!option) option = {};

      // time setting
      var fadeDuration = option.fadeDuration || constants.default.fadeDuration;
      var fadeInterval = option.fadeInterval || constants.default.fadeInterval;
      var fadeStep = Math.min(fadeInterval / fadeDuration, 1);

      // set visible
      var s = self.element.toastBox.style;
      s.opacity = 1;

      // start fade out and call callback function.
      _fade(s, -fadeStep, fadeInterval, cancellationToken, function () {
        s.display = 'none';
        if (callback) callback();
      });

      return self;
    };

    // run fade animation
    function _fade(style, step, interval, cancellationToken, callback) {
      (function fade() {
        if (cancellationToken.isCancellationRequested) {
          style.opacity = step < 0 ? 0 : 1;
          if (callback) callback();
          return;
        }
        style.opacity = Number(style.opacity) + step;
        if (step < 0 && style.opacity < 0) {
          if (callback) callback();
        } else if (step > 0 && style.opacity >= 1) {
          if (callback) callback();
        } else {
          var timeoutId = setTimeout(function () {
            timeoutId = null;
            fade();
          }, interval);
          cancellationToken.register(function () {
            if (!timeoutId) return;
            clearTimeout(timeoutId);
            timeoutId = null;
            if (callback) callback();
          });
        }
      })();
    };

    return VanillaToast;
  })();

  // CancellationToken class
  var CancellationToken = (function () {
    function CancellationToken() {
      this.isCancellationRequested = false;
      this.cancelCallbacks = [];
    }

    CancellationToken.prototype.cancel = function () {
      this.isCancellationRequested = true;
      var copiedCallbacks = this.cancelCallbacks.slice();
      while (copiedCallbacks.length) copiedCallbacks.shift()();
    };

    CancellationToken.prototype.register = function (callback) {
      this.cancelCallbacks.push(callback);
    };

    CancellationToken.prototype.dispose = function () {
      while (this.cancelCallbacks.length) this.cancelCallbacks.shift();
    };

    return CancellationToken;
  })();

  // TaskQueue class from https://github.com/talsu/async-task-queue
  var TaskQueue = (function () {
    function TaskQueue() {
      this.queue = [];
      this.isExecuting = false;
    }

    // enqueue job. run immediately.
    TaskQueue.prototype.enqueue = function (job) {
      // enqueue.
      this.queue.push(job);
      // call execute.
      dequeueAndExecute(this);
    };

    // Dequeue and execute job.
    function dequeueAndExecute(self) {
      if (self.isExecuting) return;

      // Dequeue Job.
      var job = self.queue.shift();
      if (!job) return;

      //Execute Job.
      self.isExecuting = true;

      // Pass next job execute callback.
      job(function () {
        self.isExecuting = false;
        dequeueAndExecute(self);
      });
    }

    return TaskQueue;
  })();

  // export
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = new VanillaToast();
    }
    exports.vanillaToast = new VanillaToast();
  } else {
    this.vanillaToast = new VanillaToast();
  }
}.call(this));


/*==================== SHOW MENU ====================*/
const showMenu = (toggleId, navId) => {
  const toggle = document.getElementById(toggleId),
    nav = document.getElementById(navId)

  // Validate that variables exist
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      // We add the show-menu class to the div tag with the nav__menu class
      nav.classList.toggle('show-menu')
    })
  }
}
showMenu('nav-toggle', 'nav-menu')

/*==================== REMOVE MENU MOBILE ====================*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction() {
  const navMenu = document.getElementById('nav-menu')
  // When we click on each nav__link, we remove the show-menu class
  navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*==================== SCROLL SECTIONS ACTIVE LINK ====================*/
const sections = document.querySelectorAll('section[id]')

function scrollActive() {
  const scrollY = window.pageYOffset

  sections.forEach(current => {
    const sectionHeight = current.offsetHeight
    const sectionTop = current.offsetTop - 50;
    sectionId = current.getAttribute('id')

    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.add('active-link')
    } else {
      document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.remove('active-link')
    }
  })
}
window.addEventListener('scroll', scrollActive)

/*==================== CHANGE BACKGROUND HEADER ====================*/
function scrollHeader() {
  const nav = document.getElementById('header')
  // When the scroll is greater than 200 viewport height, add the scroll-header class to the header tag
  if (this.scrollY >= 200) nav.classList.add('scroll-header'); else nav.classList.remove('scroll-header')
}
window.addEventListener('scroll', scrollHeader)

/*==================== SHOW SCROLL TOP ====================*/
function scrollTop() {
  const scrollTop = document.getElementById('scroll-top');
  // When the scroll is higher than 560 viewport height, add the show-scroll class to the a tag with the scroll-top class
  if (this.scrollY >= 560) scrollTop.classList.add('show-scroll'); else scrollTop.classList.remove('show-scroll')
}
window.addEventListener('scroll', scrollTop)

/*==================== DARK LIGHT THEME ====================*/
const themeButton = document.getElementById('theme-button')
const darkTheme = 'dark-theme'
const iconTheme = 'bx-toggle-right'

// Previously selected topic (if user selected)
const selectedTheme = localStorage.getItem('selected-theme')
const selectedIcon = localStorage.getItem('selected-icon')

// We obtain the current theme that the interface has by validating the dark-theme class
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light'
const getCurrentIcon = () => themeButton.classList.contains(iconTheme) ? 'bx-toggle-left' : 'bx-toggle-right'

// We validate if the user previously chose a topic
if (selectedTheme) {
  // If the validation is fulfilled, we ask what the issue was to know if we activated or deactivated the dark
  document.body.classList[selectedTheme === 'dark' ? 'add' : 'remove'](darkTheme)
  themeButton.classList[selectedIcon === 'bx-toggle-left' ? 'add' : 'remove'](iconTheme)
}

// Activate / deactivate the theme manually with the button
themeButton.addEventListener('click', () => {
  // Add or remove the dark / icon theme
  document.body.classList.toggle(darkTheme)
  themeButton.classList.toggle(iconTheme)
  // We save the theme and the current icon that the user chose
  localStorage.setItem('selected-theme', getCurrentTheme())
  localStorage.setItem('selected-icon', getCurrentIcon())
})

/*==================== SCROLL REVEAL ANIMATION ====================*/
const sr = ScrollReveal({
  distance: '30px',
  duration: 1800,
  reset: true,
});

sr.reveal(`.home__data, .home__img, 
           .decoration__data,
           .accessory__content,
           .footer__content`, {
  origin: 'top',
  interval: 200,
})

sr.reveal(`.share__img, .send__content`, {
  origin: 'left'
})

sr.reveal(`.share__data, .send__img`, {
  origin: 'right'
})

async function getData() {
  const apiUrl = "https://strugend-backend.onrender.com/get-query"

  try {
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json()
      })
      .then(data => {
        console.log(data);
        displayData(data)
      })

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

function displayData(data) {
  const apiDataElement = document.getElementById('apiData');
  apiDataElement.innerHTML = ''; // Clear previous data

  // Iterate through each item in the data and create a table row
  data.forEach(item => {
    const row = document.createElement('tr');

    const cell1 = document.createElement('td');
    cell1.textContent = '-';
    row.appendChild(cell1);

    // Create and append table cells for the desired data fields
    const cell2 = document.createElement('td');
    cell2.textContent = item.email; // Replace 'data1' with the actual property name
    row.appendChild(cell2);

    const cell3 = document.createElement('td');
    cell3.textContent = item.query; // Replace 'data2' with the actual property name
    row.appendChild(cell3);

    // Append the row to the table body
    apiDataElement.appendChild(row);
  });
}

async function sendData() {
  const apiUrl = "https://strugend-backend.onrender.com/create-query"
  const data = {
    email: document.getElementById("lemail").value,
    query: document.getElementById("lquery").value
  }

  if (data.email && data.query) {

    const emailRegex = /.+@.+\..+/;
    if (emailRegex.test(data.email)) {
      try {
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then(responseData => {
            console.log('Data posted successfully:', responseData);
            vanillaToast
              .success('We have recivied your wish buddy', { duration: 700, fadeDuration: 200 })
              .success('Someone will send your gift soon', { duration: 600, fadeDuration: 150 })
          })
          .catch(error => {
            console.error('Error posting data:', error);
            vanillaToast
              .error('We cant receive your wish right now. Sorry', { duration: 800, fadeDuration: 100, closeButton: false })
          });
      } catch (error) {
        console.error('Error posting data:', error);
      }
    } else {
      vanillaToast
        .error('Buddy you need to enter proper email address.', { duration: 800, fadeDuration: 100, closeButton: false });
    }


  } else {
    vanillaToast
      .error('If you dont fill anything then how will we listen to your wished. How will we get to know each other? How will we share happiness?', { duration: 3000, fadeDuration: 1, closeButton: false })
  }
}

function commingSoon() {
  vanillaToast
    .show('Coming Soon')
}

function login() {
  var username = document.getElementById('uName').value;
  var password = document.getElementById('pass').value;

    if (username === "srijan" && password === "password") {
        vanillaToast
          .success('We have recivied your wish buddy', { duration: 700, fadeDuration: 200 })
        return getData()
    } else {
      vanillaToast
      .error('Wrong Credentials', { duration: 800, fadeDuration: 100, closeButton: false })
    }
}