const modal = document.querySelector(".modal");
const modalOverlay = document.querySelector(".modal-overlay");
const closeBtn = document.querySelector(".modal .modal_close-btn");
const pageContent = document.querySelector(".page-content");


const createCookie = () => {
  let maxAge = ";max-age=10";
  let path = ";path=/";
  document.cookie = "live-blogger-popup=displayed" + maxAge + path;
};

const displayModal = () => {
  if (document.cookie.indexOf("live-blogger-popup") == -1) {
    modal.classList.add("active");
    modalOverlay.classList.add("active");
    pageContent.classList.add("blur"); 
    createCookie();
  }
};

window.addEventListener("DOMContentLoaded", displayModal);

closeBtn.addEventListener("click", () => {
  modal.classList.remove("active");
  modalOverlay.classList.remove("active");
  pageContent.classList.remove("blur");
});

