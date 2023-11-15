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
      .success('We have recivied your request and we are processing it', { duration: 700, fadeDuration: 200 })
    return getData()
  } else {
    vanillaToast
      .error('Wrong Credentials', { duration: 800, fadeDuration: 100, closeButton: false })
  }
}

async function getOnboarded(user) {
  document.querySelectorAll('.component').forEach(component => {
    component.classList.add('hidden');
  });


  console.log(user);
  // Show the selected component
  document.getElementById('component' + 5).classList.remove('hidden');

  var progressBar = document.getElementById('progress');
  var currentWidth = parseInt(progressBar.style.width);

  if (currentWidth < 100) {
    currentWidth += 20; // You can adjust the increment value
    progressBar.style.width = currentWidth + '%';
  }

  const apiUrl = "https://strugend-backend.onrender.com/onboarded"
  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(user)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.body}`);
    }
    return response.json();
  })
    .then(responseData => {
      console.log('Data posted successfully:', responseData);
    })

}

function increaseProgress() {
  var progressBar = document.getElementById('progress');
  var currentWidth = parseInt(progressBar.style.width) || 16.6666666667;

  if (currentWidth < 100) {
    currentWidth += 16.6666666667; // You can adjust the increment value
    progressBar.style.width = currentWidth + '%';
  }
}

function decreaseProgress() {
  var progressBar = document.getElementById('progress');
  var currentWidth = parseInt(progressBar.style.width) || 100;

  if (currentWidth > 0) {
    currentWidth -= 16.6666666667; // You can adjust the increment value
    progressBar.style.width = currentWidth + '%';
  }
}

function addArraysWithoutDuplicates(arr1, arr2) {
  // Create a Set to store unique elements
  let uniqueElements = new Set([...arr1, ...arr2]);

  // Convert the Set back to an array
  let resultArray = Array.from(uniqueElements);

  return resultArray;
}

function submitUserData() {

  //////////////// HEAR RADIO //////////////////////////////
  let HearRadios = document.getElementsByName('hear');

  // Find the selected radio value
  let selectedHear = "";
  for (let i = 0; i < HearRadios.length; i++) {
    if (HearRadios[i].checked) {
      selectedHear = HearRadios[i].value;
      break;
    }
  }

  if (selectedHear === "Others") {
    let usernameInput = document.getElementById('radioInput');
    selectedHear = usernameInput.value;
  }

  let checkedCheckboxes = [];
  let checkboxes = document.querySelectorAll('input[type="checkbox"]');
  let textInputValue = document.getElementById('checkInput')?.value;

  checkboxes.forEach(function (checkbox) {
    if (checkbox.checked) {
      checkedCheckboxes.push(checkbox.value);
      if (checkbox.value === "Others") {
        checkedCheckboxes.push(textInputValue);
      }
    }
  });


  // // Get values of checkbox inputs
  let checkedCheckboxes2 = [];
  let checkboxes2 = document.querySelectorAll('input[type="checkbox"]');
  let textInputValue2 = document.getElementById('radioInputt')?.value;

  checkboxes2.forEach((checkbox2) => {
    if (checkbox2.checked) {
      checkedCheckboxes2.push(checkbox2.value);
      if (checkbox2.value === "Otherss") {
        checkedCheckboxes2.push(textInputValue2);
      }
    }
  });

  const resultArray = addArraysWithoutDuplicates(checkedCheckboxes, checkedCheckboxes2);

  let unwantedElements = ["option1", "Others", "Otherss"]

  let finalArrayCheckbox = resultArray.filter(items => !unwantedElements.includes(items))

  const user = {
    hear: selectedHear,
    name: document.getElementById('name').value,
    role: document.getElementById('role').value,
    email: document.getElementById('email').value,
    company: document.getElementById('company').value,
    website: document.getElementById('website').value,
    goal: finalArrayCheckbox,
    // intrestedTechStack: checkedCheckboxes2,
    meetingId: "",
  };

  if (typeof(Storage) !== "undefined") {
      
    // Save data to localStorage
    localStorage.setItem('user', JSON.stringify(user));
    
    // Retrieve data from localStorage
    var storedUser = localStorage.getItem("user");
    
    // Display the retrieved data
    if (storedUser) {
      console.log("Ok1");
      try {
        getOnboarded(JSON.parse(storedUser))
        .then(result => {
            console.log("Ok2");
        })
      } catch (error) {
        console.error("Error in try block:", error);
      }
    } else {
      console.log("Ok2");
      getOnboarded(user)
    }
    
  }

  // Submit data to the server and clear the form
  clearForm();
}

function clearForm() {
  console.log("**********Clear Form Testing*********************");
  document.getElementById('userForm').reset();
}

function switchToComponent(componentNumber) {
  // Hide all components
  document.querySelectorAll('.component').forEach(component => {
    component.classList.add('hidden');
  });

  // Show the selected component
  document.getElementById('component' + componentNumber).classList.remove('hidden');

  var progressBar = document.getElementById('progress');
  var currentWidth = parseInt(progressBar.style.width) || 20;

  if (currentWidth < 100) {
    currentWidth += 20; // You can adjust the increment value
    progressBar.style.width = currentWidth + '%';
  }
}


// function readInputValues() {
//   // Get radio inputs with the name 'gender'
//   let HearRadios = document.getElementsByName('hear');

//   // Find the selected radio value
//   let selectedHear = "";
//   for (let i = 0; i < HearRadios.length; i++) {
//     if (HearRadios[i].checked) {
//       selectedHear = HearRadios[i].value;
//       break;
//     }
//   }

//   if (selectedHear === "Others") {
//     let usernameInput = document.getElementById('radioInput');
//     selectedHear = usernameInput.value;
//   }

//   // Display the values
//   alert('Selected Hear: ' + selectedHear);
// }

// function readValues() {
//   // Get values of checkbox inputs
//   let checkedCheckboxes2 = [];
//   let checkboxes2 = document.querySelectorAll('input[type="checkbox"]');
//   let textInputValue2 = document.getElementById('radioInput')?.value;

//   checkboxes2.forEach(function (checkbox2) {
//     if (checkbox2.checked) {
//       checkedCheckboxes2.push(checkbox2.value);
//       if (checkbox2.value === "Others") {
//         checkedCheckboxes2.push(textInputValue2);
//       }
//     }
//   });

//   console.log(checkedCheckboxes2);
// }

function showError(message) {
  vanillaToast
      .error(message, { duration: 800, fadeDuration: 100, closeButton: false })
}

function validateInputAndSwitch2() {
  var radioToBeInput = document.getElementById('radioToBeInput');
  var radioInput = document.getElementById('radioInput');

  var radioInputs = document.querySelectorAll('input[name="hear"]');
  var isRadioSelected = Array.from(radioInputs).some(radio => radio.checked);

  var isTextInputFilled = radioToBeInput.checked && radioInput.value.trim() !== '';

  if (isRadioSelected || isTextInputFilled) {
    switchToComponent(2);
  } else {
    showError("Please choose at least one option or fill in the 'Others' input.")
  } 
}

function validateInputsAndSwitch3() {
  var nameInput = document.getElementById('name');
  var roleInput = document.getElementById('role');
  var emailInput = document.getElementById('email');
  var companyInput = document.getElementById('company');
  var websiteInput = document.getElementById('website');
  var termsCheckbox = document.getElementById('termsCheckbox');

  // Regular expression for email validation
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Regular expression for website validation
  var websiteRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/.*)?$/;

  var inputs = [
    { element: nameInput, fieldName: 'Your Name' },
    { element: roleInput, fieldName: 'Your Role' },
    { element: emailInput, fieldName: 'Your Email', regex: emailRegex, errorMessage: 'Invalid email format' },
    { element: companyInput, fieldName: 'Company Name' },
    { element: websiteInput, fieldName: 'Company Website', regex: websiteRegex, errorMessage: 'Invalid website format' }
  ];

  var areAllInputsFilled = inputs.every(input => {
    var value = input.element.value.trim();
    if (value === '') {
      showError(input.fieldName + ' is required');
    }
    return value !== '';
  });

  var areAllFormatsValid = inputs.every(input => {
    if (input.regex && !input.regex.test(input.element.value.trim())) {
      showError(input.errorMessage);
      return false;
    }
    return true;
  });

  if (!termsCheckbox.checked) {
    showError("Kindly check the terms and conditions");
  } else if (areAllInputsFilled && areAllFormatsValid && termsCheckbox.checked) {
    // Proceed to the next component (adjust the switchToComponent function according to your needs)
    switchToComponent(3);
  }
}

function validateCheckboxesAndSwitch4() {
  var checkbox1 = document.getElementById('checkbox1');
  var checkbox2 = document.getElementById('checkbox2');
  var checkbox3 = document.getElementById('checkbox3');
  var checkbox4 = document.getElementById('checkbox4');
  var checkToBeInput = document.getElementById('checkToBeInput');
  var checkInput = document.getElementById('checkInput');

  var checkboxes = [
    { element: checkbox1, label: 'Build Chatbot' },
    { element: checkbox2, label: 'Integrate Chatgpt' },
    { element: checkbox3, label: 'Develop Own AI' },
    { element: checkbox4, label: 'AI with Web3' },
  ];

  var areAnyCheckboxesChecked = checkboxes.some(checkbox => checkbox.element.checked);

  var isOtherCheckboxChecked = checkToBeInput.checked;
  var isOtherCheckboxInputFilled = isOtherCheckboxChecked && checkInput.value.trim() !== '';

  if (areAnyCheckboxesChecked || isOtherCheckboxInputFilled) {
    // Proceed to the next component (adjust the switchToComponent function according to your needs)
    switchToComponent(4);
  } else {
    showError('Please choose at least one option or fill in the "Others" input.');
  }
}


function validateTechStackAndSubmit5() {
  var checkbox11 = document.getElementById('checkbox11');
  var checkbox22 = document.getElementById('checkbox22');
  var checkbox33 = document.getElementById('checkbox33');
  var checkbox44 = document.getElementById('checkbox44');
  var checkToBeInputt = document.getElementById('checkToBeInputt');
  var radioInputt = document.getElementById('radioInputt');

  var checkboxes = [
    { element: checkbox11, label: 'Nextjs + OpenaAi + Other Tech..' },
    { element: checkbox22, label: 'Django + OpenaAi + Other Tech..' },
    { element: checkbox33, label: 'React + Custom Model + Other Tech..' },
    { element: checkbox44, label: 'Laama + Web3 + Other Tech..' },
  ];

  var areAnyCheckboxesChecked = checkboxes.some(checkbox => checkbox.element.checked);

  var isOtherCheckboxChecked = checkToBeInputt.checked;
  var isOtherCheckboxInputFilled = isOtherCheckboxChecked && radioInputt.value.trim() !== '';

  if (areAnyCheckboxesChecked || isOtherCheckboxInputFilled) {
    // Call a function to submit the user data or switch to the next component
    submitUserData();
  } else {
    showError('Please choose at least one option or fill in the "Others" input.');
  }
}